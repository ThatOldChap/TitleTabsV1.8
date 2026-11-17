const REDIRECT_RULE_ID = 1;
const APP_NAMES = ['production', 'sandbox'];

function parseConfiguredAppUrl(value, appName) {
	try {
		const url = new URL(value);
		if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password || url.search || url.hash) {
			return null;
		}
		const path = url.pathname.replace(/\/+$/, '');
		return {
			name: appName,
			origin: url.origin,
			path: `${path}/`,
			url: `${url.origin}${path}/`
		};
	} catch {
		return null;
	}
}

async function getConfiguredApps() {
	const { appUrls, mainUrl } = await chrome.storage.sync.get(['appUrls', 'mainUrl']);
	if (appUrls) {
		return APP_NAMES
			.map((name) => parseConfiguredAppUrl(appUrls[name], name))
			.filter(Boolean);
	}
	if (!mainUrl) return [];

	try {
		const oldOrigin = new URL(mainUrl).origin;
		const legacyPaths = { production: '/Empower', sandbox: '/EmpowerTest' };
		return APP_NAMES.map((name) => ({
			name,
			origin: oldOrigin,
			path: `${legacyPaths[name]}/`,
			url: `${oldOrigin}${legacyPaths[name]}/`
		}));
	} catch {
		return [];
	}
}

async function getAuthorizedApps() {
	const apps = await getConfiguredApps();
	const accessResults = await Promise.all(apps.map(async (app) => {
		const url = new URL(app.url);
		return chrome.permissions.contains({ origins: [`${url.protocol}//${url.hostname}/*`] });
	}));
	return apps.filter((_app, index) => accessResults[index]);
}

function escapeRegex(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function synchronizeRedirect() {
	const [apps, rules] = await Promise.all([
		getAuthorizedApps(),
		chrome.declarativeNetRequest.getDynamicRules()
	]);
	const productionApp = apps.find((app) => app.name === 'production');
	const removeRuleIds = rules.filter((rule) => rule.id === REDIRECT_RULE_ID).map((rule) => rule.id);
	let addRules = [];
	if (productionApp) {
		const templateResponse = await fetch(chrome.runtime.getURL('rules.json'));
		if (!templateResponse.ok) throw new Error('Could not load redirect rule template.');
		const templateRules = await templateResponse.json();
		addRules = templateRules.map((rule) => ({
			...rule,
			action: {
				...rule.action,
				redirect: {
					...rule.action.redirect,
						regexSubstitution: rule.action.redirect.regexSubstitution.replaceAll('__PRODUCTION_APP_URL__', productionApp.url)
				}
			},
			condition: {
				...rule.condition,
					regexFilter: rule.condition.regexFilter.replaceAll('__PRODUCTION_ORIGIN_REGEX__', escapeRegex(productionApp.origin))
			}
		}));
	}

	await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
}

async function injectIntoTab(tabId, tabUrl, configuredApps) {
	if (!tabUrl || !configuredApps.length) return;
	try {
		const tab = new URL(tabUrl);
		const isConfiguredApp = configuredApps.some((app) => tab.origin === app.origin &&
			(tab.pathname === app.path.slice(0, -1) || tab.pathname.startsWith(app.path)));
		if (!isConfiguredApp) return;
		await chrome.scripting.executeScript({
			target: { tabId },
			files: ['jquery-3.6.0.js', 'titleChanger.js']
		});
	} catch {
		// Restricted browser pages and tabs without host access cannot receive scripts.
	}
}

async function injectConfiguredTabs() {
	const apps = await getAuthorizedApps();
	if (!apps.length) return;
	const tabs = await chrome.tabs.query({});
	await Promise.all(tabs.map((tab) => injectIntoTab(tab.id, tab.url, apps)));
}

async function applySettings() {
	await synchronizeRedirect();
	await injectConfiguredTabs();
}

function permissionPattern(urlValue) {
	const url = new URL(urlValue);
	return `${url.protocol}//${url.hostname}/*`;
}

let pendingSettingsTask;

function completePendingSettings() {
	if (pendingSettingsTask) return pendingSettingsTask;

	pendingSettingsTask = (async () => {
		const { pendingAppUrls } = await chrome.storage.sync.get('pendingAppUrls');
		if (!pendingAppUrls) {
			return { ok: false, error: 'There are no pending database URLs to save.' };
		}

		const apps = APP_NAMES.map((name) => parseConfiguredAppUrl(pendingAppUrls[name], name));
		if (apps.some((app) => !app)) {
			throw new Error('A pending database URL is invalid.');
		}
		const urls = Object.fromEntries(apps.map((app) => [app.name, app.url]));
		const patterns = [...new Set(Object.values(urls).map(permissionPattern))];
		const permissionsGranted = await Promise.all(patterns.map((pattern) =>
			chrome.permissions.contains({ origins: [pattern] })
		));
		if (permissionsGranted.some((granted) => !granted)) {
			return { ok: false, error: 'Database host access has not been granted.' };
		}

		const previousApps = await getConfiguredApps();
		await chrome.storage.sync.set({ appUrls: urls });
		await chrome.storage.sync.remove('pendingAppUrls');
		await chrome.storage.sync.remove('mainUrl');
		await applySettings();

		const previousPatterns = [...new Set(previousApps.map((app) => permissionPattern(app.url)))];
		const obsoletePatterns = previousPatterns.filter((pattern) => !patterns.includes(pattern));
		if (obsoletePatterns.length) {
			await chrome.permissions.remove({ origins: obsoletePatterns });
		}
		return { ok: true };
	})().finally(() => {
		pendingSettingsTask = null;
	});

	return pendingSettingsTask;
}

chrome.permissions.onAdded.addListener(() => {
	completePendingSettings().catch((error) => console.error('Could not save the configured database URLs:', error));
});

chrome.runtime.onInstalled.addListener(() => {
	applySettings().catch((error) => console.error('Could not initialize PLM site setting:', error));
});

chrome.runtime.onStartup.addListener(() => {
	applySettings().catch((error) => console.error('Could not restore PLM site setting:', error));
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
	if (changeInfo.status === 'complete') {
		getAuthorizedApps()
			.then((apps) => injectIntoTab(tabId, tab.url, apps))
			.catch(() => {});
	}
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	let operation;
	if (message.type === 'settingsChanged') {
		operation = applySettings().then(() => ({ ok: true }));
	} else if (message.type === 'savePendingSettings') {
		operation = completePendingSettings();
	} else {
		return;
	}
	operation
		.then(sendResponse)
		.catch((error) => sendResponse({ ok: false, error: error.message }));
	return true;
});