const settingsForm = document.getElementById("settings-form");
const productionUrlInput = document.getElementById("production-url");
const sandboxUrlInput = document.getElementById("sandbox-url");
const statusText = document.getElementById("status");
const saveButton = document.getElementById("save");
const resetButton = document.getElementById("reset");
const copyTabTitleButton = document.getElementById("copy-tab-title");
const copyStatusText = document.getElementById("copy-status");
const bomCostFeaturesInput = document.getElementById("bom-cost-features-enabled");
const featureStatusText = document.getElementById("feature-status");
const itemBomFeaturesInput = document.getElementById("item-bom-features-enabled");
const itemBomFeatureStatusText = document.getElementById("item-bom-feature-status");
let savedUrls = { production: null, sandbox: null };

function escapeHtml(value) {
	return value.replace(/[&<>"']/g, (character) => ({
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#39;'
	})[character]);
}

copyTabTitleButton.addEventListener("click", async () => {
	copyTabTitleButton.disabled = true;
	copyStatusText.textContent = '';
	copyStatusText.style.color = '#3f5657';
	try {
		const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
		if (!tab?.title || !tab.url) {
			throw new Error('The active tab does not have a title or URL to copy.');
		}

		const htmlLink = `<a href="${escapeHtml(tab.url)}">${escapeHtml(tab.title)}</a>`;
		await navigator.clipboard.write([
			new ClipboardItem({
				'text/html': new Blob([htmlLink], { type: 'text/html' }),
				'text/plain': new Blob([tab.title], { type: 'text/plain' })
			})
		]);
		copyStatusText.textContent = 'Tab title link copied.';
	} catch (error) {
		copyStatusText.textContent = error.message || 'Could not copy the active tab link.';
		copyStatusText.style.color = '#a12622';
	} finally {
		copyTabTitleButton.disabled = false;
	}
});

function parseAppUrl(value, label) {
	let url;
	try {
		url = new URL(value.trim());
	} catch {
		throw new Error(`${label} must be a valid HTTP or HTTPS URL.`);
	}
	if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password ||
		url.search || url.hash) {
		throw new Error(`${label} must be an HTTP or HTTPS URL without credentials, a query, or a fragment.`);
	}
	const path = url.pathname.replace(/\/+$/, '');
	return new URL(`${url.origin}${path}/`);
}

function permissionPattern(url) {
	return `${url.protocol}//${url.hostname}/*`;
}

function showStatus(message, isError = false) {
	statusText.textContent = message;
	statusText.style.color = isError ? '#a12622' : '#3f5657';
}

async function notifyBackground() {
	const response = await chrome.runtime.sendMessage({ type: 'settingsChanged' });
	if (!response?.ok) {
		throw new Error(response?.error || 'Could not apply the site setting.');
	}
}

chrome.storage.sync.get([
	'appUrls',
	'pendingAppUrls',
	'mainUrl',
	'bomCostRollupFeaturesEnabled',
	'itemBomFeaturesEnabled'
]).then(({ appUrls, pendingAppUrls, mainUrl, bomCostRollupFeaturesEnabled, itemBomFeaturesEnabled }) => {
	bomCostFeaturesInput.checked = bomCostRollupFeaturesEnabled !== false;
	itemBomFeaturesInput.checked = itemBomFeaturesEnabled !== false;
	try {
		if (appUrls) {
			savedUrls = {
				production: parseAppUrl(appUrls.production, 'Live database URL'),
				sandbox: parseAppUrl(appUrls.sandbox, 'Sandbox database URL')
			};
		} else if (mainUrl) {
			const oldOrigin = new URL(mainUrl).origin;
			savedUrls = {
				production: new URL(`${oldOrigin}/Empower/`),
				sandbox: new URL(`${oldOrigin}/EmpowerTest/`)
			};
		}
		const formUrls = pendingAppUrls ? {
			production: parseAppUrl(pendingAppUrls.production, 'Live database URL'),
			sandbox: parseAppUrl(pendingAppUrls.sandbox, 'Sandbox database URL')
		} : savedUrls;
		if (formUrls.production) productionUrlInput.value = formUrls.production.href;
		if (formUrls.sandbox) sandboxUrlInput.value = formUrls.sandbox.href;
	} catch {
		showStatus('A saved database URL is invalid. Enter both URLs again.', true);
	}
}).catch(() => showStatus('Could not load the saved site setting.', true));

bomCostFeaturesInput.addEventListener('change', async () => {
	const previousValue = !bomCostFeaturesInput.checked;
	bomCostFeaturesInput.disabled = true;
	featureStatusText.textContent = 'Saving setting...';
	featureStatusText.style.color = '#3f5657';
	try {
		await chrome.storage.sync.set({
			bomCostRollupFeaturesEnabled: bomCostFeaturesInput.checked
		});
		featureStatusText.textContent = 'Setting saved. Open BOM Cost Rollup tabs will refresh.';
	} catch (error) {
		bomCostFeaturesInput.checked = previousValue;
		featureStatusText.textContent = error.message || 'Could not save this setting.';
		featureStatusText.style.color = '#a12622';
	} finally {
		bomCostFeaturesInput.disabled = false;
	}
});

itemBomFeaturesInput.addEventListener('change', async () => {
	const previousValue = !itemBomFeaturesInput.checked;
	itemBomFeaturesInput.disabled = true;
	itemBomFeatureStatusText.textContent = 'Saving setting...';
	itemBomFeatureStatusText.style.color = '#3f5657';
	try {
		await chrome.storage.sync.set({
			itemBomFeaturesEnabled: itemBomFeaturesInput.checked
		});
		itemBomFeatureStatusText.textContent = 'Setting saved. Open Item BOM pages will refresh.';
	} catch (error) {
		itemBomFeaturesInput.checked = previousValue;
		itemBomFeatureStatusText.textContent = error.message || 'Could not save this setting.';
		itemBomFeatureStatusText.style.color = '#a12622';
	} finally {
		itemBomFeaturesInput.disabled = false;
	}
});

settingsForm.addEventListener('submit', async (event) => {
	event.preventDefault();
	let urls;
	try {
		urls = {
			production: parseAppUrl(productionUrlInput.value, 'Live database URL'),
			sandbox: parseAppUrl(sandboxUrlInput.value, 'Sandbox database URL')
		};
	} catch (error) {
		showStatus(error.message, true);
		return;
	}
	const permissionPatterns = [...new Set(Object.values(urls).map(permissionPattern))];

	saveButton.disabled = true;
	showStatus('Saving database URLs...');
	try {
		await chrome.storage.sync.set({
			pendingAppUrls: {
				production: urls.production.href,
				sandbox: urls.sandbox.href
			}
		});

		const missingPatterns = [];
		for (const pattern of permissionPatterns) {
			if (!await chrome.permissions.contains({ origins: [pattern] })) {
				missingPatterns.push(pattern);
			}
		}
		if (missingPatterns.length) {
			showStatus('Requesting access to the configured database host(s)...');
			const granted = await chrome.permissions.request({ origins: missingPatterns });
			if (!granted) {
				showStatus('Database access was not granted. Your URLs are saved here; you can try again.', true);
				return;
			}
		}

		const response = await chrome.runtime.sendMessage({ type: 'savePendingSettings' });
		if (!response?.ok) {
			throw new Error(response?.error || 'Could not apply the database URLs.');
		}
		savedUrls = urls;
		productionUrlInput.value = urls.production.href;
		sandboxUrlInput.value = urls.sandbox.href;
		showStatus('Database URLs saved. Title changes are active in open tabs.');
	} catch (error) {
		showStatus(error.message || 'Could not save the site setting.', true);
	} finally {
		saveButton.disabled = false;
	}
});

resetButton.addEventListener('click', async () => {
	resetButton.disabled = true;
	try {
		await chrome.storage.sync.remove(['appUrls', 'pendingAppUrls', 'mainUrl']);
		await notifyBackground();
		const oldPatterns = [...new Set(Object.values(savedUrls)
			.filter(Boolean)
			.map(permissionPattern))];
		if (oldPatterns.length) {
			await chrome.permissions.remove({ origins: oldPatterns });
		}
		savedUrls = { production: null, sandbox: null };
		productionUrlInput.value = '';
		sandboxUrlInput.value = '';
		showStatus('Database URL settings cleared.');
	} catch (error) {
		showStatus(error.message || 'Could not clear the site setting.', true);
	} finally {
		resetButton.disabled = false;
	}
});