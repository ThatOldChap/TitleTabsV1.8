(() => {
	if (globalThis.__omnifyTitleTabsInstalled) return;
	globalThis.__omnifyTitleTabsInstalled = true;

const SELECTORS = Object.freeze({
	pageTitle: 'head > title',
	mainObjectTitle: '#CPMainPage_frmSubTitleCommon_frmSubTitleMenu_lblMainMenu_Text',
	changeReportTitle: '#CPMainPage_ObjectTitleBar1_lblMainMenu_Text',
	vendorTitle: '#CPMainPage_frmSubTitleCommon_frmSubTitleMenu_lblMainMenu_Text > b',
	itemBomTable: '#CPMainPage_frmBOM_dgBOM',
	bomCostsTable: '#CPMainPage_dgBOM',
	itemBomHeader: '#CPMainPage_frmBOM_lbl_Item_BOM_Header',
    ecoItemChangesPane: '#CPMainPage_frmSubTitleCommon_frmSubTitleMenu_lblMainMenu_Text > b',
	ecoAllBomChangesTable: '#CPMainPage_frmBOMChanges_dgRedlines_BOMChanges_All',
	ecoItemBomChangesTable: '#CPMainPage_frmBOMChanges_dgRedlines_BOMChanges_Item',
	projectName: '#CPMainPage_frmSubTitleCommon_frmSubTitleMenu_lblMainMenu_Text',
	projectDescription: '#CPMainPage_frmGeneral_dgGeneralFields_lblGeneralPage_Field_Value_1'
});
const BOM_COST_DELTA_COLUMN = 'DELTA ($)';
const BOM_COST_UOM_COLUMN = 'COST UOM';
const BOM_LEAD_TIME_DELTA_COLUMN = 'LEAD TIME DELTA';
const BOM_COST_FEATURES_SETTING = 'bomCostRollupFeaturesEnabled';
const ITEM_BOM_FEATURES_SETTING = 'itemBomFeaturesEnabled';
const DRAWING_VIEW_COLUMNS = ['Refdes', 'Qty', 'UoM', 'Part Number', 'Rev', 'Description'];
const DRAWING_VIEW_COLUMN_ORDER = [
	'Refdes', 'Qty', 'UoM', 'Part Number', 'Rev', 'Current Rev', 'Description'
];
const drawingViewOriginalCellOrders = new WeakMap();
let bomCostRollupFeaturesEnabled = true;
let bomCostRollupSettingLoaded = false;
let itemBomFeaturesEnabled = true;
let itemBomFeaturesSettingLoaded = false;

function getElementText(selector) {
	return document.querySelector(selector)?.innerText?.trim() || '';
}

function updateTitle() {
	const path = window.location.pathname.split('/').filter(Boolean);
	const serverPage = path[2];
	const objectType = path[3];
	let newTitle;

	switch (serverPage) {
		case 'Reporter':
			newTitle = 'Empower Reporter';
			break;
		case 'Administrator':
			newTitle = 'Empower Administrator';
			break;
		case 'Desktop':
			switch (objectType) {
				case 'Item':
					newTitle = getElementText(SELECTORS.mainObjectTitle);
					if (getElementText(SELECTORS.itemBomHeader) === 'Parts List/BOM') {
						updateDescriptionWidth(SELECTORS.itemBomTable);
					}
					break;
				case 'Change': {
					const changePage = path[4] || '';
					const isRedlinesPage = changePage.toLowerCase() === 'redlines.aspx';
					const changeTitleSelector = isRedlinesPage
						? SELECTORS.ecoItemChangesPane
						: changePage.includes('Object')
							? SELECTORS.mainObjectTitle
							: changePage.includes('Reports') ? SELECTORS.changeReportTitle : null;
					const changeTitle = isRedlinesPage
						? document.querySelector(changeTitleSelector)?.textContent?.trim() || ''
						: changeTitleSelector ? getElementText(changeTitleSelector) : '';
					newTitle = changeTitle
						? isRedlinesPage ? changeTitle : changeTitle.slice(5)
						: '';
					for (const tableSelector of [SELECTORS.ecoAllBomChangesTable, SELECTORS.ecoItemBomChangesTable]) {
						const table = document.querySelector(tableSelector);
						if (table && !table.hidden) updateDescriptionWidth(tableSelector);
					}
					break;
				}
				case 'Vendor': {
					const vendorName = getElementText(SELECTORS.vendorTitle);
					newTitle = vendorName ? `Vendor: ${trimVendorName(vendorName)}` : '';
					break;
				}
				case 'VendorItem':
					newTitle = trimVendorName(getElementText(SELECTORS.mainObjectTitle));
					break;
				case 'Quality':
					newTitle = getElementText(SELECTORS.mainObjectTitle).split(' ')[1] || '';
					break;
				case 'Project': {
					const projectName = getElementText(SELECTORS.projectName).split(' ')[1] || '';
					const projectDescription = getElementText(SELECTORS.projectDescription);
					newTitle = projectDescription ? `${projectName} - ${projectDescription}` : projectName;
					break;
				}
				case 'Service': {
					const serviceTitle = getElementText(SELECTORS.mainObjectTitle);
					newTitle = serviceTitle ? `Service Object: ${serviceTitle.slice(15)}` : '';
					break;
				}
				case 'Search':
					newTitle = 'Empower Database Search';
					break;
				case 'Document':
					newTitle = 'Empower Document Search';
					break;
				case 'User':
					newTitle = 'Empower User Search';
					break;
				case 'Preferences':
					newTitle = 'Empower User Preferences';
					break;
				case 'NewObject':
					newTitle = 'Empower New Object Wizard';
					break;
				default:
					return;
			}
			break;
		default:
			return;
	}

	if (!newTitle) return;
	const pageTitle = document.querySelector(SELECTORS.pageTitle);
	if (pageTitle && pageTitle.textContent !== newTitle) document.title = newTitle;
}

function trimVendorName(text) {
	return text ? text.replace(/\s*-\s*(MANUFACTURER|SUPPLIER)/i, '') : '';
}

function updateDescriptionWidth(tableSelector) {
	const table = document.querySelector(tableSelector);
	if (!table?.rows?.length) return;
	updateNoWrapColumnWidth(table, 'Description');
}

function updateNoWrapColumnWidth(table, columnName) {
	const columnIndex = findTableColumnIndex(table, columnName);
	if (columnIndex < 0) return;

	let longestCell = null;
	for (const row of table.rows) {
		if (row === getTableHeaderRow(table) ||
			row.dataset.bomCostGroupHeader ||
			row.dataset.omnifyBomRevisionGroupHeader) continue;
		const cell = table.id === 'CPMainPage_dgBOM'
			? getBomCostsCell(table, row, columnName)
			: row.cells[columnIndex];
		if (cell && (!longestCell || cell.textContent.length > longestCell.textContent.length)) {
			longestCell = cell;
		}
	}
	if (longestCell) longestCell.style.whiteSpace = 'nowrap';
}

function updateBomColumns(tableSelector) {
	const table = document.querySelector(tableSelector);
	if (!table) return;
	if (tableSelector === SELECTORS.itemBomTable) {
		removeItemBomRevisionGroupedHeader(table);
	}
	const headerRow = getTableHeaderRow(table);
	if (!headerRow) return;

	const duplicateUomIndexes = Array.from(headerRow.cells)
		.map((cell, index) => ({ cell, index }))
		.filter(({ cell }) =>
			normalizeBomColumnName(cell.textContent) === 'UOM' &&
			cell.dataset.omnifyOriginalColumnName !== 'UNIT OF MEASURE'
		)
		.map(({ index }) => index);
	for (const uomColumnIndex of duplicateUomIndexes.reverse()) {
		for (const row of table.rows) {
			row.cells[uomColumnIndex]?.remove();
		}
	}

	const unitOfMeasureColumnIndex = findTableColumnIndex(table, 'UNIT OF MEASURE');
	const quantityColumnIndex = findTableColumnIndex(table, 'Qty');
	if (unitOfMeasureColumnIndex >= 0 && quantityColumnIndex >= 0 &&
		unitOfMeasureColumnIndex !== quantityColumnIndex) {
		for (const row of table.rows) {
			const unitOfMeasureCell = row.cells[unitOfMeasureColumnIndex];
			const quantityCell = row.cells[quantityColumnIndex];
			if (unitOfMeasureCell && quantityCell && unitOfMeasureCell !== quantityCell.nextElementSibling) {
				row.insertBefore(unitOfMeasureCell, quantityCell.nextElementSibling);
			}
		}
	}

	const isItemBomTable = tableSelector === SELECTORS.itemBomTable;
	const isEcoBomTable = tableSelector === SELECTORS.ecoAllBomChangesTable ||
		tableSelector === SELECTORS.ecoItemBomChangesTable;
	if (isItemBomTable || isEcoBomTable) {
		moveTableColumnAfter(table, 'Rev', 'Part Number');
		if (isItemBomTable) moveTableColumnAfter(table, 'Current Rev', 'Rev');
		const underEcoTarget = isItemBomTable && findTableColumnIndex(table, 'Current Rev') >= 0
			? 'Current Rev'
			: findTableColumnIndex(table, 'Rev') >= 0 ? 'Rev' : 'Part Number';
		moveTableColumnAfter(table, 'Under ECO', underEcoTarget);
		moveTableColumnAfter(table, 'Overage', 'Qty');
		moveTableColumnBefore(table, 'Refdes', 'Description');
		if (isItemBomTable) moveTableColumnToEndByHeader(table, 'Notes');
		renameTableColumn(table, 'UNIT OF MEASURE', 'UoM');
		renameTableColumn(table, 'Failure Prob/Impact', 'FPI', 'Failure Probability / Impact');
		moveTableColumnAfter(table, 'FPI', 'UoM');
		renameTableColumn(table, 'Spare Part QTY', 'Spare Qty');
		wrapTableHeaderLabel(table, 'Under ECO', 'Under', 'ECO');
		wrapTableHeaderLabel(table, 'Spare Qty', 'Spare', 'Qty');
		if (isItemBomTable && findTableColumnIndex(table, 'Rev') >= 0 &&
			findTableColumnIndex(table, 'Current Rev') >= 0) {
			renameTableColumn(table, 'Rev', 'BOM');
			renameTableColumn(table, 'Current Rev', 'Current');
			addItemBomRevisionGroupedHeader(table);
		}
		updateBomRevisionHighlights(table);
		updateNoWrapColumnWidth(table, 'Notes');
	}
}

function moveTableColumnBefore(table, columnName, targetColumnName) {
	const columnIndex = findTableColumnIndex(table, columnName);
	const targetColumnIndex = findTableColumnIndex(table, targetColumnName);
	if (columnIndex < 0 || targetColumnIndex < 0 || columnIndex === targetColumnIndex - 1) return;

	for (const row of table.rows) {
		const cell = row.cells[columnIndex];
		const targetCell = row.cells[targetColumnIndex];
		if (cell && targetCell) row.insertBefore(cell, targetCell);
	}
}

function moveTableColumnAfter(table, columnName, targetColumnName) {
	const columnIndex = findTableColumnIndex(table, columnName);
	const targetColumnIndex = findTableColumnIndex(table, targetColumnName);
	if (columnIndex < 0 || targetColumnIndex < 0 || columnIndex === targetColumnIndex + 1) return;

	for (const row of table.rows) {
		const cell = row.cells[columnIndex];
		const targetCell = row.cells[targetColumnIndex];
		if (cell && targetCell) row.insertBefore(cell, targetCell.nextElementSibling);
	}
}

function moveTableColumnToEndByHeader(table, columnName) {
	const headerRow = getTableHeaderRow(table);
	const columnIndex = findTableColumnIndex(table, columnName);
	if (!headerRow || columnIndex < 0 || columnIndex === headerRow.cells.length - 1) return;

	for (const row of table.rows) {
		if (row.dataset.omnifyBomRevisionGroupHeader) continue;
		const cell = row.cells[columnIndex];
		if (cell) row.appendChild(cell);
	}
}

function findTableColumnIndex(table, columnName) {
	const headerRow = getTableHeaderRow(table);
	if (!headerRow) return -1;
	const normalizedColumnName = normalizeBomColumnName(columnName);
	const groupRow = table.id === SELECTORS.itemBomTable.slice(1)
		? Array.from(table.rows).find((row) => row.dataset.omnifyBomRevisionGroupHeader)
		: null;
	if (groupRow) {
		const matchingCell = [...groupRow.cells, ...headerRow.cells].find((cell) =>
			!cell.dataset.omnifyBomRevisionGroupCell &&
			(normalizeBomColumnName(cell.textContent) === normalizedColumnName ||
				cell.dataset.omnifyOriginalColumnName === normalizedColumnName)
		);
		const columnIndex = matchingCell
			? Number(matchingCell.dataset.omnifyColumnIndex)
			: NaN;
		return Number.isInteger(columnIndex) ? columnIndex : -1;
	}
	return Array.from(headerRow.cells).findIndex((cell) =>
		normalizeBomColumnName(cell.textContent) === normalizedColumnName ||
		cell.dataset.omnifyOriginalColumnName === normalizedColumnName
	);
}

function normalizeBomColumnName(name) {
	return name.trim().replace(/\s+/g, ' ').toUpperCase();
}

function renameTableColumn(table, columnName, displayName, tooltip = '') {
	const columnIndex = findTableColumnIndex(table, columnName);
	const headerCell = columnIndex >= 0 ? getTableHeaderRow(table)?.cells[columnIndex] : null;
	if (!headerCell) return;

	const originalColumnName = normalizeBomColumnName(columnName);
	if (headerCell.dataset.omnifyOriginalColumnName !== originalColumnName) {
		headerCell.dataset.omnifyOriginalColumnName = originalColumnName;
	}
	if (headerCell.dataset.omnifyDisplayName !== displayName) {
		if (replaceTableHeaderText(headerCell, columnName, displayName) ||
			normalizeBomColumnName(headerCell.textContent) === normalizeBomColumnName(displayName)) {
			headerCell.dataset.omnifyDisplayName = displayName;
		}
	}
	if (tooltip && headerCell.title !== tooltip) headerCell.title = tooltip;
}

function replaceTableHeaderText(headerCell, columnName, displayName) {
	const labelPattern = new RegExp(
		columnName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'),
		'i'
	);
	const walker = document.createTreeWalker(headerCell, NodeFilter.SHOW_TEXT);
	let textNode;
	while ((textNode = walker.nextNode())) {
		if (!labelPattern.test(textNode.textContent)) continue;
		textNode.textContent = textNode.textContent.replace(labelPattern, displayName);
		return true;
	}
	return false;
}

function wrapTableHeaderLabel(table, columnName, firstLine, secondLine) {
	const columnIndex = findTableColumnIndex(table, columnName);
	const headerCell = columnIndex >= 0 ? getTableHeaderRow(table)?.cells[columnIndex] : null;
	if (!headerCell) return;

	headerCell.style.whiteSpace = 'normal';
	const originalColumnName = normalizeBomColumnName(columnName);
	if (!headerCell.dataset.omnifyOriginalColumnName) {
		headerCell.dataset.omnifyOriginalColumnName = originalColumnName;
	}
	if (headerCell.dataset.omnifyWrappedColumnName === originalColumnName) return;

	const labelPattern = new RegExp(
		columnName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'),
		'i'
	);
	const walker = document.createTreeWalker(headerCell, NodeFilter.SHOW_TEXT);
	let textNode;
	while ((textNode = walker.nextNode())) {
		const match = labelPattern.exec(textNode.textContent);
		if (!match) continue;

		const prefix = textNode.textContent.slice(0, match.index);
		const suffix = textNode.textContent.slice(match.index + match[0].length);
		textNode.textContent = `${prefix}${firstLine}`;
		const lineBreak = document.createElement('br');
		textNode.after(lineBreak, document.createTextNode(` ${secondLine}${suffix}`));
		headerCell.dataset.omnifyWrappedColumnName = originalColumnName;
		return;
	}
}

function addItemBomRevisionGroupedHeader(table) {
	const headerRow = getTableHeaderRow(table);
	if (!headerRow?.parentElement) return;
	const revisionColumnIndex = findTableColumnIndex(table, 'Rev');
	const currentRevisionColumnIndex = findTableColumnIndex(table, 'Current Rev');
	if (revisionColumnIndex < 0 || currentRevisionColumnIndex !== revisionColumnIndex + 1) return;

	const sourceCells = Array.from(headerRow.cells);
	const groupRow = document.createElement('tr');
	groupRow.dataset.omnifyBomRevisionGroupHeader = 'true';
	headerRow.dataset.omnifyBomRevisionSubHeader = 'true';
	for (let columnIndex = 0; columnIndex < sourceCells.length; columnIndex++) {
		const sourceCell = sourceCells[columnIndex];
		sourceCell.dataset.omnifyColumnIndex = String(columnIndex);
		if (columnIndex === revisionColumnIndex) {
			const groupCell = document.createElement(sourceCell.tagName.toLowerCase());
			groupCell.className = sourceCell.className;
			groupCell.style.cssText = sourceCell.style.cssText;
			groupCell.style.width = '';
			groupCell.textContent = 'Rev';
			groupCell.colSpan = 2;
			groupCell.dataset.omnifyBomRevisionGroupCell = 'true';
			groupRow.appendChild(groupCell);
		} else if (columnIndex === currentRevisionColumnIndex) {
			continue;
		} else {
			sourceCell.rowSpan = 2;
			groupRow.appendChild(sourceCell);
		}
	}
	headerRow.parentElement.insertBefore(groupRow, headerRow);
}

function removeItemBomRevisionGroupedHeader(table) {
	const groupRow = Array.from(table.rows).find((row) =>
		row.dataset.omnifyBomRevisionGroupHeader
	);
	if (!groupRow) return;

	const headerRow = Array.from(table.rows).find((row) =>
		row.dataset.omnifyBomRevisionSubHeader
	);
	if (!headerRow) {
		groupRow.remove();
		return;
	}

	const headerCells = [...groupRow.cells, ...headerRow.cells]
		.filter((cell) => !cell.dataset.omnifyBomRevisionGroupCell)
		.sort((left, right) =>
			Number(left.dataset.omnifyColumnIndex) - Number(right.dataset.omnifyColumnIndex)
		);
	for (const cell of headerCells) {
		cell.rowSpan = 1;
		cell.removeAttribute('data-omnify-column-index');
		headerRow.appendChild(cell);
	}
	headerRow.removeAttribute('data-omnify-bom-revision-sub-header');
	groupRow.remove();
}

function updateBomRevisionHighlights(table) {
	const revisionColumnIndex = findTableColumnIndex(table, 'Rev');
	const currentRevisionColumnIndex = findTableColumnIndex(table, 'Current Rev');
	const underEcoColumnIndex = findTableColumnIndex(table, 'Under ECO');
	const lifecycleColumnIndex = findTableColumnIndex(table, 'Lifecycle');
	const quantityColumnIndex = findTableColumnIndex(table, 'Qty');
	const overageColumnIndex = findTableColumnIndex(table, 'Overage');
	const fpiColumnIndex = findTableColumnIndex(table, 'FPI');
	const failureProbImpactColumnIndex = fpiColumnIndex >= 0
		? fpiColumnIndex
		: findTableColumnIndex(table, 'Failure Prob/Impact');
	const headerRow = getTableHeaderRow(table);
	if (!headerRow) return;

	for (const row of table.rows) {
		if (row === headerRow || row.dataset.omnifyBomRevisionGroupHeader) continue;
		if (revisionColumnIndex >= 0 && currentRevisionColumnIndex >= 0) {
			const revisionCell = row.cells[revisionColumnIndex];
			const currentRevisionCell = row.cells[currentRevisionColumnIndex];
			if (revisionCell && currentRevisionCell) {
				updateBomCellHighlight(
					revisionCell,
					isRevisionGreater(currentRevisionCell.textContent, revisionCell.textContent),
					'data-omnify-rev-original-background'
				);
			}
		}

		if (underEcoColumnIndex >= 0) {
			const underEcoCell = row.cells[underEcoColumnIndex];
			if (underEcoCell) {
				updateBomCellHighlight(
					underEcoCell,
					underEcoCell.textContent.trim().toLowerCase() === 'yes',
					'data-omnify-eco-original-background'
				);
			}
		}

		if (lifecycleColumnIndex >= 0) {
			const lifecycleCell = row.cells[lifecycleColumnIndex];
			if (lifecycleCell) {
				const lifecycleValue = lifecycleCell.textContent.trim();
				const normalizedLifecycleValue = lifecycleValue.toUpperCase();
				updateBomCellHighlight(
					lifecycleCell,
					lifecycleValue !== '' &&
						normalizedLifecycleValue !== 'RELEASED' &&
						normalizedLifecycleValue !== 'READY FOR RELEASE',
					'data-omnify-lifecycle-original-background'
				);
				updateBomCellHighlight(
					lifecycleCell,
					normalizedLifecycleValue === 'READY FOR RELEASE',
					'data-omnify-lifecycle-ready-original-background',
					'#fff2cc'
				);
			}
		}

		const quantityCell = quantityColumnIndex >= 0 ? row.cells[quantityColumnIndex] : null;
		const quantity = quantityCell
			? Number(quantityCell.textContent.trim().replace(/,/g, ''))
			: 0;
		const hasPositiveQuantity = Number.isFinite(quantity) && quantity > 0;
		if (overageColumnIndex >= 0) {
			const overageCell = row.cells[overageColumnIndex];
			if (overageCell) {
				updateBomCellHighlight(
					overageCell,
					hasPositiveQuantity && overageCell.textContent.trim() === '',
					'data-omnify-overage-original-background',
					'#fff2cc'
				);
			}
		}
		if (failureProbImpactColumnIndex >= 0) {
			const fpiCell = row.cells[failureProbImpactColumnIndex];
			if (fpiCell) {
				updateBomCellHighlight(
					fpiCell,
					hasPositiveQuantity && fpiCell.textContent.trim() === '',
					'data-omnify-fpi-original-background',
					'#fff2cc'
				);
			}
		}
	}
}

function updateBomCellHighlight(
	cell,
	shouldHighlight,
	originalBackgroundAttribute,
	highlightColor = '#f4cccc'
) {
	if (shouldHighlight) {
		if (!cell.hasAttribute(originalBackgroundAttribute)) {
			cell.setAttribute(originalBackgroundAttribute, cell.style.backgroundColor);
		}
		cell.style.backgroundColor = highlightColor;
	} else if (cell.hasAttribute(originalBackgroundAttribute)) {
		cell.style.backgroundColor = cell.getAttribute(originalBackgroundAttribute);
		cell.removeAttribute(originalBackgroundAttribute);
	}
}

function isRevisionGreater(currentRevision, revision) {
	const currentValue = currentRevision.trim();
	const revisionValue = revision.trim();
	if (!currentValue || !revisionValue) return false;

	const currentNumber = Number(currentValue);
	const revisionNumber = Number(revisionValue);
	if (Number.isFinite(currentNumber) && Number.isFinite(revisionNumber)) {
		return currentNumber > revisionNumber;
	}
	return currentValue.localeCompare(revisionValue, undefined, {
		numeric: true,
		sensitivity: 'base'
	}) > 0;
}

function ensureBomCostsColumnKeys(table) {
	const headerRow = getTableHeaderRow(table);
	if (!headerRow) return;

	const columnKeys = Array.from(headerRow.cells, (cell) => {
		const key = cell.dataset.bomCostColumnKey || normalizeBomColumnName(cell.textContent);
		cell.dataset.bomCostColumnKey = key;
		return key;
	});
	for (const row of table.rows) {
		if (row.dataset.bomCostGroupHeader) continue;
		if (row.cells.length !== columnKeys.length) continue;
		for (let index = 0; index < columnKeys.length; index++) {
			const cell = row.cells[index];
			if (cell) cell.dataset.bomCostColumnKey = columnKeys[index];
		}
	}
}

function getBomCostsCell(table, row, columnName) {
	const key = normalizeBomColumnName(columnName);
	return Array.from(row.cells).find((cell) => cell.dataset.bomCostColumnKey === key) || null;
}

function getTableHeaderRow(table) {
	if (!table?.rows?.length) return null;
	if (table.id !== 'CPMainPage_dgBOM') {
		return Array.from(table.rows).find((row) =>
			!row.dataset.omnifyBomRevisionGroupHeader
		) || table.rows[0];
	}

	return Array.from(table.rows).find((row) =>
		!row.dataset.bomCostGroupHeader && Array.from(row.cells).some((cell) =>
			cell.textContent.trim().replace(/\s+/g, ' ').toUpperCase() === 'DESCRIPTION'
		)
	) || table.rows[0];
}

function updateBomTableColumns() {
	if (itemBomFeaturesSettingLoaded && itemBomFeaturesEnabled) {
		updateBomColumns(SELECTORS.ecoAllBomChangesTable);
		updateBomColumns(SELECTORS.ecoItemBomChangesTable);
		updateBomColumns(SELECTORS.itemBomTable);
		const itemBomTable = document.querySelector(SELECTORS.itemBomTable);
		if (itemBomTable && getElementText(SELECTORS.itemBomHeader) === 'Parts List/BOM') {
			addDrawingViewControl(itemBomTable);
		}
	}
	if (itemBomFeaturesSettingLoaded && itemBomFeaturesEnabled) {
		for (const tableSelector of [SELECTORS.ecoAllBomChangesTable, SELECTORS.ecoItemBomChangesTable]) {
			const table = document.querySelector(tableSelector);
			if (table && !table.hidden) updateBomRevisionHighlights(table);
		}
	}
	for (const tableSelector of [SELECTORS.ecoAllBomChangesTable, SELECTORS.ecoItemBomChangesTable]) {
		const table = document.querySelector(tableSelector);
		if (table && !table.hidden) updateDescriptionWidth(tableSelector);
	}
	if (getElementText(SELECTORS.itemBomHeader) === 'Parts List/BOM') {
		const table = document.querySelector(SELECTORS.itemBomTable);
		if (table && !table.hidden) updateDescriptionWidth(SELECTORS.itemBomTable);
	}

	const path = window.location.pathname.split('/').filter(Boolean);
	const reportPath = path.slice(-5, -1).map((segment) => segment.toLowerCase());
	if (reportPath.join('/') === 'apps/desktop/item/reports' &&
		path[path.length - 1]?.toLowerCase().startsWith('bomcosts')) {
		if (!bomCostRollupSettingLoaded || !bomCostRollupFeaturesEnabled) return;
		const table = document.querySelector(SELECTORS.bomCostsTable);
		addBomCostsContributorControl(table);
		const formattedColumns = updateBomCostsTotals(table);
		updateDescriptionWidth(SELECTORS.bomCostsTable);
		orderBomCostsColumns(table);
		moveTableColumnToEnd(table, 'Description');
		sizeBomCostsColumns(table, formattedColumns);
		addBomCostsGroupedHeaders(table);
		updateBomCostsWeightTotal(table);
		updateBomCostsWeightValues(table);
		updateBomCostsContributorHighlight(table);
	}
}

function addDrawingViewControl(table) {
	let standardButton = document.getElementById('omnify-standard-view');
	let drawingButton = document.getElementById('omnify-drawing-view');
	if (!standardButton || !drawingButton) {
		const createModifyLink = Array.from(document.querySelectorAll('a')).find((link) =>
			link.textContent.trim().replace(/\s+/g, ' ').toLowerCase() === 'create/modify'
		);
		if (!createModifyLink) return;
		standardButton = standardButton || createDrawingViewModeButton(
			'omnify-standard-view',
			'Standard View',
			true
		);
		drawingButton = drawingButton || createDrawingViewModeButton(
			'omnify-drawing-view',
			'Drawing View',
			false
		);
		createModifyLink.after(standardButton, drawingButton);
	}
	const isDrawingView = drawingButton.getAttribute('aria-pressed') === 'true';
	setDrawingViewButtonState(standardButton, !isDrawingView);
	setDrawingViewButtonState(drawingButton, isDrawingView);
	updateDrawingViewColumns(table, isDrawingView);
}

function createDrawingViewModeButton(id, label, isActive) {
	const button = document.createElement('button');
	button.id = id;
	button.type = 'button';
	button.textContent = label;
	button.style.marginLeft = '6px';
	button.addEventListener('click', () => {
		const isDrawingView = id === 'omnify-drawing-view';
		const standardButton = document.getElementById('omnify-standard-view');
		const drawingButton = document.getElementById('omnify-drawing-view');
		if (!standardButton || !drawingButton) return;
		setDrawingViewButtonState(standardButton, !isDrawingView);
		setDrawingViewButtonState(drawingButton, isDrawingView);
		updateDrawingViewColumns(
			document.querySelector(SELECTORS.itemBomTable),
			isDrawingView
		);
	});
	setDrawingViewButtonState(button, isActive);
	return button;
}

function setDrawingViewButtonState(button, isActive) {
	button.setAttribute('aria-pressed', String(isActive));
	button.style.backgroundColor = isActive ? '#1f4e79' : '';
	button.style.color = isActive ? '#fff' : '';
	button.style.borderColor = isActive ? '#163a5a' : '';
	button.style.boxShadow = isActive ? 'inset 0 2px 4px rgba(0, 0, 0, 0.35)' : '';
	button.style.fontWeight = isActive ? '600' : '';
}

function updateDrawingViewColumns(table, isActive) {
	if (!table) return;
	const hasRevisionGroup = Array.from(table.rows).some((row) =>
		row.dataset.omnifyBomRevisionGroupHeader
	);
	if (hasRevisionGroup) removeItemBomRevisionGroupedHeader(table);
	restoreDrawingViewCellOrder(table);
	rememberDrawingViewCellOrder(table);
	const findColumnName = ['Find Number', 'Find #', 'Find']
		.find((columnName) => findTableColumnIndex(table, columnName) >= 0);
	const vendorColumnName = ['Vendor', 'Vendors']
		.find((columnName) => findTableColumnIndex(table, columnName) >= 0);
	const drawingViewColumns = [
		...(findColumnName ? [findColumnName] : []),
		...DRAWING_VIEW_COLUMNS,
		...(vendorColumnName ? [vendorColumnName] : [])
	];
	const drawingViewColumnOrder = [
		...(findColumnName ? [findColumnName] : []),
		...DRAWING_VIEW_COLUMN_ORDER,
		...(vendorColumnName ? [vendorColumnName] : [])
	];
	if (isActive) reorderDrawingViewColumns(table, drawingViewColumnOrder);
	if (hasRevisionGroup) {
		addItemBomRevisionGroupedHeader(table);
		for (const row of table.rows) {
			if (!row.dataset.omnifyBomRevisionGroupHeader) continue;
			const revisionGroupCell = Array.from(row.cells).find((cell) =>
				cell.dataset.omnifyBomRevisionGroupCell
			);
			if (revisionGroupCell) revisionGroupCell.colSpan = isActive ? 1 : 2;
		}
	}
	const headerRow = getTableHeaderRow(table);
	if (!headerRow) return;
	const visibleColumnIndexes = new Set(drawingViewColumns
		.map((columnName) => findTableHeaderColumnIndex(table, columnName))
		.filter((columnIndex) => columnIndex >= 0));
	const vendorColumnIndex = vendorColumnName
		? findTableHeaderColumnIndex(table, vendorColumnName)
		: -1;
	const editColumnIndex = findEditControlColumnIndex(table);
	if (editColumnIndex >= 0) visibleColumnIndexes.add(editColumnIndex);

	for (const row of table.rows) {
		for (let cellIndex = 0; cellIndex < row.cells.length; cellIndex++) {
			const cell = row.cells[cellIndex];
			const columnIndex = cell.dataset.omnifyColumnIndex !== undefined
				? Number(cell.dataset.omnifyColumnIndex)
				: cellIndex;
			if (!cell.dataset.omnifyBomRevisionGroupCell && hasEditControl(cell)) {
				visibleColumnIndexes.add(columnIndex);
			}
		}
	}

	for (const row of table.rows) {
		for (let cellIndex = 0; cellIndex < row.cells.length; cellIndex++) {
			const cell = row.cells[cellIndex];
			let columnIndex = cell.dataset.omnifyColumnIndex !== undefined
				? Number(cell.dataset.omnifyColumnIndex)
				: cellIndex;
			if (cell.dataset.omnifyBomRevisionGroupCell) columnIndex = -1;
			if (!cell.hasAttribute('data-omnify-drawing-view-original-display')) {
				cell.setAttribute('data-omnify-drawing-view-original-display', cell.style.display);
			}
			const isProtectedLeadingColumn = columnIndex >= 0 && columnIndex < 2;
			const shouldHide = !isProtectedLeadingColumn &&
				((!isActive && vendorColumnIndex >= 0 && columnIndex === vendorColumnIndex) ||
					(isActive && !visibleColumnIndexes.has(columnIndex) &&
						!cell.dataset.omnifyBomRevisionGroupCell));
			cell.style.display = shouldHide
				? 'none'
				: cell.getAttribute('data-omnify-drawing-view-original-display');
		}
	}
}

function rememberDrawingViewCellOrder(table) {
	for (const row of table.rows) {
		if (!row.dataset.omnifyBomRevisionGroupHeader &&
			!drawingViewOriginalCellOrders.has(row)) {
			drawingViewOriginalCellOrders.set(row, Array.from(row.cells));
		}
	}
}

function restoreDrawingViewCellOrder(table) {
	for (const row of table.rows) {
		if (row.dataset.omnifyBomRevisionGroupHeader) continue;
		const originalCells = drawingViewOriginalCellOrders.get(row);
		if (!originalCells) continue;
		const currentCells = Array.from(row.cells);
		if (currentCells.length === originalCells.length &&
			currentCells.every((cell, index) => cell === originalCells[index])) continue;
		for (const cell of originalCells) row.appendChild(cell);
	}
}

function reorderDrawingViewColumns(table, columnNames) {
	let anchorColumnIndex = findEditControlColumnIndex(table);
	if (anchorColumnIndex < 0) return;
	for (const columnName of columnNames) {
		if (findTableColumnIndex(table, columnName) < 0) continue;
		moveTableColumnAfterIndex(table, columnName, anchorColumnIndex);
		anchorColumnIndex = findTableColumnIndex(table, columnName);
	}
}

function moveTableColumnAfterIndex(table, columnName, targetColumnIndex) {
	const columnIndex = findTableColumnIndex(table, columnName);
	if (columnIndex < 0 || targetColumnIndex < 0 ||
		columnIndex === targetColumnIndex || columnIndex === targetColumnIndex + 1) return;

	for (const row of table.rows) {
		if (row.dataset.omnifyBomRevisionGroupHeader) continue;
		const cell = row.cells[columnIndex];
		const targetCell = row.cells[targetColumnIndex];
		if (cell && targetCell) row.insertBefore(cell, targetCell.nextElementSibling);
	}
}

function findEditControlColumnIndex(table) {
	const headerRow = getTableHeaderRow(table);
	for (const row of table.rows) {
		if (row === headerRow || row.dataset.omnifyBomRevisionGroupHeader) continue;
		const editCellIndex = Array.from(row.cells).findIndex(hasEditControl);
		if (editCellIndex >= 0) return editCellIndex;
	}
	return 1;
}

function findTableHeaderColumnIndex(table, columnName) {
	const headerRow = getTableHeaderRow(table);
	if (!headerRow) return -1;
	const normalizedColumnName = normalizeBomColumnName(columnName);
	const groupRow = Array.from(table.rows).find((row) =>
		row.dataset.omnifyBomRevisionGroupHeader
	);
	if (groupRow) {
		const matchingCell = [...groupRow.cells, ...headerRow.cells].find((cell) =>
			!cell.dataset.omnifyBomRevisionGroupCell &&
			(normalizeBomColumnName(cell.textContent) === normalizedColumnName ||
				cell.dataset.omnifyOriginalColumnName === normalizedColumnName)
		);
		const columnIndex = matchingCell
			? Number(matchingCell.dataset.omnifyColumnIndex)
			: NaN;
		return Number.isInteger(columnIndex) ? columnIndex : -1;
	}
	return Array.from(headerRow.cells).findIndex((cell) =>
		normalizeBomColumnName(cell.textContent) === normalizedColumnName ||
		cell.dataset.omnifyOriginalColumnName === normalizedColumnName
	);
}

function hasEditControl(cell) {
	return Array.from(cell.querySelectorAll(
		'button, a, input[type="button"], input[type="submit"], input[type="image"], img'
	)).some((control) => {
		const label = [
			control.textContent,
			control.getAttribute('aria-label'),
			control.getAttribute('title'),
			control.getAttribute('alt'),
			control.getAttribute('value')
		].filter(Boolean).join(' ');
		return /\bedit\b/i.test(label);
	});
}

function addBomCostsContributorControl(table) {
	if (!table?.parentElement) return;
	let checkbox = document.querySelector('#bom-cost-contributor-highlight');
	if (!checkbox) {
		const checkboxLabel = document.createElement('label');
		checkboxLabel.style.display = 'inline-flex';
		checkboxLabel.style.alignItems = 'center';
		checkboxLabel.style.gap = '6px';
		checkboxLabel.style.margin = '4px 8px 4px 0';
		checkbox = document.createElement('input');
		checkbox.type = 'checkbox';
		checkbox.id = 'bom-cost-contributor-highlight';
		checkbox.addEventListener('change', () => updateBomCostsContributorHighlight(table));
		checkboxLabel.append(checkbox, document.createTextNode('Check Cost/Lead Time Contributors'));
		table.parentElement.insertBefore(checkboxLabel, table);
	}

	let scalingSelect = document.querySelector('#bom-cost-contributor-scaling');
	if (scalingSelect) return;
	const scalingLabel = document.createElement('label');
	scalingLabel.style.display = 'inline-flex';
	scalingLabel.style.alignItems = 'center';
	scalingLabel.style.gap = '4px';
	scalingLabel.style.margin = '4px 0';
	scalingLabel.appendChild(document.createTextNode('Scale: '));
	scalingSelect = document.createElement('select');
	scalingSelect.id = 'bom-cost-contributor-scaling';
	for (const [value, text] of [['log', 'Logarithmic'], ['linear', 'Linear']]) {
		const option = document.createElement('option');
		option.value = value;
		option.textContent = text;
		scalingSelect.appendChild(option);
	}
	scalingSelect.value = 'linear';
	scalingSelect.addEventListener('change', () => updateBomCostsContributorHighlight(table));
	scalingLabel.appendChild(scalingSelect);
	const checkboxLabel = checkbox.closest('label');
	if (checkboxLabel) checkboxLabel.after(scalingLabel);
	else table.parentElement.insertBefore(scalingLabel, table);
}

function updateBomCostsContributorHighlight(table) {
	const checkbox = document.querySelector('#bom-cost-contributor-highlight');
	if (!table) return;

	const valueGroups = [
		['EXT. DESIGN COST (CAD)', 'EXT. PURCHASE COST (CAD)'],
		['DESIGN LEAD TIME (WEEKS)', 'PURCHASE LEAD TIME (WEEKS)']
	];
	const totalRow = Array.from(table.rows).find((row) =>
		Array.from(row.cells).some((cell) =>
			cell.textContent.trim().replace(/\s+/g, ' ').toUpperCase() === 'TOTAL(S):'
		)
	);
	const cellsByGroup = valueGroups.map(() => []);
	const maxima = valueGroups.map(() => 0);
	for (const row of table.rows) {
		if (row === getTableHeaderRow(table) || row === totalRow || row.dataset.bomCostGroupHeader) continue;
		for (let groupIndex = 0; groupIndex < valueGroups.length; groupIndex++) {
			for (const column of valueGroups[groupIndex]) {
				const cell = getBomCostsCell(table, row, column);
				if (!cell) continue;
				const value = parseCurrencyValue(cell.textContent);
				const amount = value === null ? null : Math.max(0, value);
				cellsByGroup[groupIndex].push({ cell, amount });
				if (amount !== null) maxima[groupIndex] = Math.max(maxima[groupIndex], amount);
			}
		}
	}

	const enabled = Boolean(checkbox?.checked);
	const scaling = document.querySelector('#bom-cost-contributor-scaling')?.value;
	for (let groupIndex = 0; groupIndex < cellsByGroup.length; groupIndex++) {
		for (const { cell, amount } of cellsByGroup[groupIndex]) {
			if (!cell.hasAttribute('data-bom-cost-contributor-original-background')) {
				cell.dataset.bomCostContributorOriginalBackground = cell.style.backgroundColor;
				cell.dataset.bomCostContributorOriginalColor = cell.style.color;
			}
			if (!enabled || amount === null) {
				cell.style.backgroundColor = cell.dataset.bomCostContributorOriginalBackground;
				cell.style.color = cell.dataset.bomCostContributorOriginalColor;
				cell.removeAttribute('data-bom-cost-contributor-original-background');
				cell.removeAttribute('data-bom-cost-contributor-original-color');
				continue;
			}

			const maximum = maxima[groupIndex];
			const scale = maximum > 0
				? scaling === 'linear' ? amount / maximum : Math.log1p(amount) / Math.log1p(maximum)
				: 0;
			const background = interpolateBomCostColor(scale);
			cell.style.backgroundColor = `rgb(${background.join(', ')})`;
			cell.style.color = getBomCostContributorTextColor(background);
		}
	}
}

function interpolateBomCostColor(scale) {
	const low = [255, 255, 255];
	const high = [160, 35, 45];
	const channels = low.map((channel, index) =>
		Math.round(channel + (high[index] - channel) * scale)
	);
	return channels;
}

function getBomCostContributorTextColor(background) {
	const luminance = background
		.map((channel) => {
			const normalized = channel / 255;
			return normalized <= 0.04045
				? normalized / 12.92
				: ((normalized + 0.055) / 1.055) ** 2.4;
		})
		.reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index], 0);
	const whiteContrast = 1.05 / (luminance + 0.05);
	const blackContrast = (luminance + 0.05) / 0.05;
	return whiteContrast > blackContrast ? 'white' : 'black';
}

function updateBomCostsTotals(table) {
	const headerRow = getTableHeaderRow(table);
	if (!headerRow) return [];
	ensureBomCostsColumnKeys(table);

	const costGroups = [
		{ lead: 'DESIGN LEAD TIME (WEEKS)', unit: 'DESIGN COST PER UNIT (CAD)', extended: 'EXT. DESIGN COST (CAD)' },
		{ lead: 'PURCHASE LEAD TIME (WEEKS)', unit: 'PURCHASE COST PER UNIT (CAD)', extended: 'EXT. PURCHASE COST (CAD)' }
	];
	const groups = costGroups.filter((group) =>
		findTableColumnIndex(table, group.lead) >= 0 &&
		findTableColumnIndex(table, group.unit) >= 0
	);
	const hasCostUom = groups.length === costGroups.length &&
		findTableColumnIndex(table, 'UOM') >= 0;
	if (!hasCostUom) removeBomCostsColumn(table, BOM_COST_UOM_COLUMN);
	for (const group of costGroups) {
		if (!groups.includes(group)) {
			removeBomCostsColumn(table, group.extended, group.unit);
		}
	}

	const totalsRow = Array.from(table.rows).find((row) =>
		Array.from(row.cells).some((cell) =>
			cell.textContent.trim().replace(/\s+/g, ' ').toUpperCase() === 'TOTAL(S):'
		)
	);
	const originalUomTotal = totalsRow ? getBomCostsCell(table, totalsRow, 'UOM') : null;
	if (originalUomTotal?.textContent) originalUomTotal.textContent = '';
	if (totalsRow) {
		const targetParent = headerRow.parentElement.tagName === 'THEAD'
			? table.tBodies[0]
			: headerRow.parentElement;
		if (targetParent) {
			const firstDataRow = targetParent === headerRow.parentElement
				? headerRow.nextElementSibling
				: targetParent.firstElementChild;
			if (totalsRow !== firstDataRow) targetParent.insertBefore(totalsRow, firstDataRow);
		}
	}

	for (const group of groups) {
		updateBomCostsLeadTime(table, group.lead, totalsRow);
		updateBomCostsCostColumns(table, headerRow, totalsRow, group);
	}
	updateBomCostsLeadTimeDelta(table, headerRow, totalsRow);
	updateBomCostsUomColumn(table, hasCostUom, headerRow, totalsRow);
	updateBomCostsDelta(table, groups.length === costGroups.length, headerRow, totalsRow);

	const formattedColumns = groups.flatMap((group) => [group.lead, group.unit, group.extended]);
	if (findTableColumnIndex(table, BOM_LEAD_TIME_DELTA_COLUMN) >= 0) {
		formattedColumns.push(BOM_LEAD_TIME_DELTA_COLUMN);
	}
	if (groups.length === costGroups.length) formattedColumns.push(BOM_COST_DELTA_COLUMN);
	if (hasCostUom) formattedColumns.push(BOM_COST_UOM_COLUMN);
	if (findTableColumnIndex(table, 'ITEM-WEIGHT(KG)') >= 0) formattedColumns.push('ITEM-WEIGHT(KG)');
	return formattedColumns;
}

function removeBomCostsColumn(table, extendedColumn, unitColumn = '') {
	const extendedIndex = findTableColumnIndex(table, extendedColumn);
	if (extendedIndex < 0) return;
	const totalsRow = Array.from(table.rows).find((row) =>
		Array.from(row.cells).some((cell) =>
			cell.textContent.trim().replace(/\s+/g, ' ').toUpperCase() === 'TOTAL(S):'
		)
	);

	for (const row of table.rows) {
		if (row.dataset.bomCostGroupHeader) continue;
		const extendedCell = getBomCostsCell(table, row, extendedColumn);
		const unitCell = unitColumn ? getBomCostsCell(table, row, unitColumn) : null;
		if (row !== getTableHeaderRow(table) && extendedCell?.textContent.trim() && unitCell) {
			if (row === totalsRow) {
				unitCell.textContent = extendedCell.textContent.trim();
			} else if (unitCell.textContent.trim()) {
				unitCell.textContent = `${extendedCell.textContent.trim()} (${unitCell.textContent.trim()})`;
			}
		}
		extendedCell?.remove();
	}
}

function updateBomCostsLeadTime(table, columnName, totalsRow) {
	let maximum = null;
	let formattedMaximum = '';
	for (const row of table.rows) {
		if (row === getTableHeaderRow(table) || row === totalsRow || row.dataset.bomCostGroupHeader) continue;
		const cell = getBomCostsCell(table, row, columnName);
		if (!cell) continue;

		const parenthesizedValue = cell.textContent.match(/\(\s*([\d,]+(?:\.\d+)?)\s*\)/);
		const valueText = formatLeadTime(parenthesizedValue ? parenthesizedValue[1] : cell.textContent.trim());
		if (!valueText) continue;
		const value = Number(valueText.replace(/,/g, ''));
		if (!Number.isFinite(value)) continue;
		if (cell.textContent.trim() !== valueText) cell.textContent = valueText;
		if (maximum === null || value > maximum) {
			maximum = value;
			formattedMaximum = valueText;
		}
	}

	const totalCell = totalsRow ? getBomCostsCell(table, totalsRow, columnName) : null;
	if (totalCell) {
		const totalText = maximum === null ? '' : `Max: ${formattedMaximum}`;
		if (totalCell.textContent.trim() !== totalText) totalCell.textContent = totalText;
		totalCell.style.whiteSpace = 'nowrap';
	}
}

function updateBomCostsLeadTimeDelta(table, headerRow, totalsRow) {
	const budgetColumn = 'DESIGN LEAD TIME (WEEKS)';
	const lastColumn = 'PURCHASE LEAD TIME (WEEKS)';
	const includeDelta = findTableColumnIndex(table, budgetColumn) >= 0 &&
		findTableColumnIndex(table, lastColumn) >= 0;

	for (const row of table.rows) {
		if (row.dataset.bomCostGroupHeader) continue;
		let deltaCell = getBomCostsCell(table, row, BOM_LEAD_TIME_DELTA_COLUMN);
		if (!includeDelta) {
			deltaCell?.remove();
			continue;
		}

		const lastCell = getBomCostsCell(table, row, lastColumn);
		if (!lastCell) continue;
		if (!deltaCell) {
			deltaCell = lastCell.cloneNode(false);
			deltaCell.removeAttribute('id');
			deltaCell.style.width = '';
			deltaCell.dataset.bomCostColumnKey = normalizeBomColumnName(BOM_LEAD_TIME_DELTA_COLUMN);
		}
		setBomCostsCellDefaultBackground(table, row, deltaCell);

		if (row === headerRow) {
			deltaCell.textContent = BOM_LEAD_TIME_DELTA_COLUMN;
			deltaCell.style.color = '';
		} else if (row === totalsRow) {
			deltaCell.textContent = '';
			deltaCell.style.color = '';
		} else {
			const budgetValue = parseLeadTimeValue(getBomCostsCell(table, row, budgetColumn)?.textContent);
			const lastValue = parseLeadTimeValue(lastCell.textContent);
			if (budgetValue === null || lastValue === null || budgetValue === lastValue) {
				deltaCell.textContent = '';
				deltaCell.style.color = '';
			} else {
				const difference = Number((lastValue - budgetValue).toFixed(10));
				if (difference === 0) {
					deltaCell.textContent = '';
					deltaCell.style.color = '';
					if (deltaCell !== lastCell.nextElementSibling) lastCell.after(deltaCell);
					continue;
				}
				deltaCell.textContent = `${difference > 0 ? '+' : '-'}${formatLeadTime(String(Math.abs(difference)))}`;
				deltaCell.style.color = difference > 0 ? 'red' : 'green';
			}
		}
		if (deltaCell !== lastCell.nextElementSibling) lastCell.after(deltaCell);
	}
}

function parseLeadTimeValue(value = '') {
	const normalized = value.trim().replace(/,/g, '');
	if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null;
	const number = Number(normalized);
	return Number.isFinite(number) ? number : null;
}

function updateBomCostsUomColumn(table, includeUom, headerRow, totalsRow) {
	const costUomIndex = findTableColumnIndex(table, BOM_COST_UOM_COLUMN);
	const uomIndex = findTableColumnIndex(table, 'UOM');
	if (!includeUom || uomIndex < 0) {
		if (costUomIndex >= 0) {
			for (const row of table.rows) {
				if (!row.dataset.bomCostGroupHeader) getBomCostsCell(table, row, BOM_COST_UOM_COLUMN)?.remove();
			}
		}
		return;
	}

	const purchaseUnitIndex = findTableColumnIndex(table, 'PURCHASE COST PER UNIT (CAD)');
	if (purchaseUnitIndex < 0) return;

	for (const row of table.rows) {
		if (row.dataset.bomCostGroupHeader) continue;
		const sourceCell = getBomCostsCell(table, row, 'UOM');
		if (!sourceCell) continue;
		if (row === totalsRow && sourceCell.textContent) sourceCell.textContent = '';

		let costUomCell = getBomCostsCell(table, row, BOM_COST_UOM_COLUMN);
		if (!costUomCell) {
			costUomCell = sourceCell.cloneNode(false);
			costUomCell.removeAttribute('id');
			costUomCell.style.width = '';
			costUomCell.dataset.bomCostUom = 'true';
			costUomCell.dataset.bomCostColumnKey = normalizeBomColumnName(BOM_COST_UOM_COLUMN);
		}

		const uomText = row === headerRow
			? BOM_COST_UOM_COLUMN
			: row === totalsRow ? '' : sourceCell.textContent.trim();
		if (costUomCell.textContent !== uomText) costUomCell.textContent = uomText;
		const purchaseCell = getBomCostsCell(table, row, 'PURCHASE COST PER UNIT (CAD)');
		if (purchaseCell && costUomCell !== purchaseCell.nextElementSibling) {
			purchaseCell.after(costUomCell);
		}
		if (purchaseCell) {
			setBomCostsCellDefaultBackground(table, row, costUomCell);
		}
	}
}

function setBomCostsCellDefaultBackground(table, row, cell) {
	const referenceCell = getBomCostsCell(table, row, 'Part Number') || row.cells[0];
	if (referenceCell) cell.style.backgroundColor = getComputedStyle(referenceCell).backgroundColor;
}

function updateBomCostsDelta(table, includeDelta, headerRow, totalsRow) {
	const existingDeltaIndex = findTableColumnIndex(table, BOM_COST_DELTA_COLUMN);
	if (!includeDelta) {
		if (existingDeltaIndex >= 0) {
			for (const row of table.rows) {
				if (row.dataset.bomCostGroupHeader) continue;
				getBomCostsCell(table, row, BOM_COST_DELTA_COLUMN)?.remove();
			}
		}
		return;
	}

	if (findTableColumnIndex(table, 'EXT. DESIGN COST (CAD)') < 0 ||
		findTableColumnIndex(table, 'EXT. PURCHASE COST (CAD)') < 0) return;

	for (const row of table.rows) {
		if (row.dataset.bomCostGroupHeader) continue;
		let deltaCell = getBomCostsCell(table, row, BOM_COST_DELTA_COLUMN);
		if (!deltaCell) {
			const sourceCell = getBomCostsCell(table, row, 'EXT. PURCHASE COST (CAD)');
			if (!sourceCell) continue;
			deltaCell = sourceCell.cloneNode(false);
			deltaCell.removeAttribute('id');
			deltaCell.style.width = '';
			deltaCell.dataset.bomCostDelta = 'true';
			deltaCell.dataset.bomCostColumnKey = normalizeBomColumnName(BOM_COST_DELTA_COLUMN);
			deltaCell.textContent = row === headerRow ? BOM_COST_DELTA_COLUMN : '';
		} else {
			deltaCell.dataset.bomCostDelta = 'true';
		}

		const purchaseCell = getBomCostsCell(table, row, 'EXT. PURCHASE COST (CAD)');
		if (purchaseCell && deltaCell !== purchaseCell.nextElementSibling) {
			purchaseCell.after(deltaCell);
		}
		setBomCostsCellDefaultBackground(table, row, deltaCell);
		if (row === headerRow || row === totalsRow) continue;

		const designValue = parseCurrencyValue(getBomCostsCell(table, row, 'EXT. DESIGN COST (CAD)')?.textContent);
		const purchaseValue = parseCurrencyValue(purchaseCell?.textContent);
		if (designValue === null || purchaseValue === null) {
			if (deltaCell.textContent) deltaCell.textContent = '';
			if (deltaCell.style.color) deltaCell.style.color = '';
			continue;
		}
		setBomCostsDeltaValue(deltaCell, purchaseValue - designValue);
	}

	const currentDeltaIndex = findTableColumnIndex(table, BOM_COST_DELTA_COLUMN);
	const totalDeltaCell = currentDeltaIndex >= 0 && totalsRow
		? getBomCostsCell(table, totalsRow, BOM_COST_DELTA_COLUMN)
		: null;
	const designTotal = totalsRow
		? parseCurrencyValue(getBomCostsCell(table, totalsRow, 'EXT. DESIGN COST (CAD)')?.textContent)
		: null;
	const purchaseTotal = totalsRow
		? parseCurrencyValue(getBomCostsCell(table, totalsRow, 'EXT. PURCHASE COST (CAD)')?.textContent)
		: null;
	if (totalDeltaCell && designTotal !== null && purchaseTotal !== null) {
		setBomCostsDeltaValue(totalDeltaCell, purchaseTotal - designTotal);
	} else if (totalDeltaCell && totalDeltaCell.textContent) {
		totalDeltaCell.textContent = '';
		totalDeltaCell.style.color = '';
	}
}

function parseCurrencyValue(value = '') {
	const numericValue = Number(value.trim().replace(/[$,]/g, ''));
	return value.trim() && Number.isFinite(numericValue) ? numericValue : null;
}

function setBomCostsDeltaValue(cell, value) {
	const formattedValue = Math.abs(value).toLocaleString('en-CA', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	}).replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');
	const sign = value > 0 ? '+' : value < 0 ? '-' : '';
	const text = `${sign}$${formattedValue}`;
	const color = value < 0 ? 'green' : value > 0 ? 'red' : '';
	if (cell.textContent !== text) cell.textContent = text;
	if (cell.style.color !== color) cell.style.color = color;
}

function updateBomCostsCostColumns(table, headerRow, totalsRow, { unit, extended }) {
	const extendedIndex = findTableColumnIndex(table, extended);
	if (extendedIndex < 0) {
		for (const row of table.rows) {
			if (row.dataset.bomCostGroupHeader) continue;
			const unitCell = getBomCostsCell(table, row, unit);
			if (!unitCell) continue;
			const extendedCell = unitCell.cloneNode(false);
			extendedCell.removeAttribute('id');
			extendedCell.style.width = '';
			extendedCell.textContent = row === headerRow ? extended : '';
			extendedCell.dataset.bomCostColumnKey = normalizeBomColumnName(extended);
			unitCell.after(extendedCell);
		}
	}

	for (const row of table.rows) {
		if (row === headerRow || row.dataset.bomCostGroupHeader) continue;
		const unitCell = getBomCostsCell(table, row, unit);
		const extendedCell = getBomCostsCell(table, row, extended);
		if (!unitCell || !extendedCell) continue;

		if (row === totalsRow) {
			if (!extendedCell.textContent.trim() && unitCell.textContent.trim() &&
				!unitCell.textContent.includes('(Max)')) {
				extendedCell.textContent = formatCurrency(unitCell.textContent.trim());
			}
			if (unitCell.textContent.trim()) {
				unitCell.textContent = formatCurrency(unitCell.textContent.trim());
			}
			if (extendedCell.textContent.trim()) {
				extendedCell.textContent = formatCurrency(extendedCell.textContent.trim());
			}
			continue;
		}

		const costValues = unitCell.textContent.match(/^\s*([\d,]+(?:\.\d+)?)\s*\(\s*([\d,]+(?:\.\d+)?)\s*\)\s*$/);
		if (costValues) {
			if (extendedCell.textContent.trim() !== costValues[1]) extendedCell.textContent = costValues[1];
			if (unitCell.textContent.trim() !== costValues[2]) unitCell.textContent = costValues[2];
		}
		if (unitCell.textContent.trim()) unitCell.textContent = formatCurrency(unitCell.textContent.trim());
		if (extendedCell.textContent.trim()) {
			extendedCell.textContent = formatCurrency(extendedCell.textContent.trim());
		}
	}

	if (!totalsRow) return;
	const extendedTotalCell = getBomCostsCell(table, totalsRow, extended);
	if (extendedTotalCell?.textContent.trim()) {
		const formattedTotal = formatCurrency(extendedTotalCell.textContent.trim());
		if (extendedTotalCell.textContent.trim() !== formattedTotal) {
			extendedTotalCell.textContent = formattedTotal;
		}
	}
	const totalUnitCell = getBomCostsCell(table, totalsRow, unit);
	if (totalUnitCell?.textContent) totalUnitCell.textContent = '';
}

function updateBomCostsWeightTotal(table) {
	if (findTableColumnIndex(table, 'ITEM-WEIGHT(KG)') < 0) return;
	const totalsRow = Array.from(table.rows).find((row) =>
		Array.from(row.cells).some((cell) =>
			cell.textContent.trim().replace(/\s+/g, ' ').toUpperCase() === 'TOTAL(S):'
		)
	);
	const totalCell = totalsRow ? getBomCostsCell(table, totalsRow, 'ITEM-WEIGHT(KG)') : null;
	if (!totalCell) return;
	const value = totalCell.textContent.trim().replace(/\s*kg$/i, '');
	const formattedTotal = value ? `${value} kg` : '';
	if (totalCell.textContent.trim() !== formattedTotal) totalCell.textContent = formattedTotal;
}

function updateBomCostsWeightValues(table) {
	if (findTableColumnIndex(table, 'ITEM-WEIGHT(KG)') < 0) return;

	for (const row of table.rows) {
		if (row.dataset.bomCostGroupHeader) continue;
		const cell = getBomCostsCell(table, row, 'ITEM-WEIGHT(KG)');
		if (!cell || !/^\s*[\d,]+(?:\.\d+)?\s*\(/.test(cell.textContent)) continue;

		const existingValue = cell.querySelector('[data-bom-weight-extended]');
		if (existingValue) {
			matchBomCostsCellFont(existingValue, getBomCostsCell(table, row, 'EXT. DESIGN COST (CAD)') || cell);
			continue;
		}

		const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
		let textNode;
		while ((textNode = walker.nextNode())) {
			const match = textNode.textContent.match(/^(\s*)([\d,]+(?:\.\d+)?)/);
			if (!match) continue;

			const range = document.createRange();
			range.setStart(textNode, match[1].length);
			range.setEnd(textNode, match[0].length);
			const extendedValue = document.createElement('span');
			extendedValue.dataset.bomWeightExtended = 'true';
			matchBomCostsCellFont(
				extendedValue,
				getBomCostsCell(table, row, 'EXT. DESIGN COST (CAD)') || cell
			);
			range.surroundContents(extendedValue);
			break;
		}
	}
}

function matchBomCostsCellFont(target, referenceCell) {
	const referenceStyle = window.getComputedStyle(referenceCell);
	target.style.fontFamily = referenceStyle.fontFamily;
	target.style.fontSize = referenceStyle.fontSize;
	target.style.fontWeight = referenceStyle.fontWeight;
	target.style.fontStyle = referenceStyle.fontStyle;
}

function formatCurrency(value) {
	const numericValue = Number(value.replace(/[$,]/g, ''));
	if (!Number.isFinite(numericValue)) return value;
	return `$${numericValue.toLocaleString('en-CA', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	})}`;
}

function orderBomCostsColumns(table) {
	const headerRow = getTableHeaderRow(table);
	if (!headerRow) return;
	const columnOrder = [
		'DESIGN LEAD TIME (WEEKS)',
		'PURCHASE LEAD TIME (WEEKS)',
		BOM_LEAD_TIME_DELTA_COLUMN,
		'EXT. DESIGN COST (CAD)',
		'EXT. PURCHASE COST (CAD)',
		BOM_COST_DELTA_COLUMN,
		'DESIGN COST PER UNIT (CAD)',
		'PURCHASE COST PER UNIT (CAD)',
		BOM_COST_UOM_COLUMN,
		'ITEM-WEIGHT(KG)',
		'Description'
	];
	const columnIndexes = columnOrder
		.map((name) => findTableColumnIndex(table, name))
		.filter((index, position, indexes) => index >= 0 && indexes.indexOf(index) === position);
	if (columnIndexes.length < 2) return;

	for (const row of table.rows) {
		if (row.dataset.bomCostGroupHeader) continue;
		const targetCells = columnOrder
			.map((name) => getBomCostsCell(table, row, name))
			.filter(Boolean);
		for (const cell of targetCells) row.appendChild(cell);
	}
}

function formatLeadTime(value) {
	return value.replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');
}

function moveTableColumnToEnd(table, columnName) {
	if (!table?.rows?.length) return;

	const headerRow = getTableHeaderRow(table);
	const columnIndex = findTableColumnIndex(table, columnName);
	if (!headerRow || columnIndex < 0 || columnIndex === headerRow.cells.length - 1) return;

	for (const row of table.rows) {
		if (row.dataset.bomCostGroupHeader) continue;
		const cell = getBomCostsCell(table, row, columnName);
		if (cell) row.appendChild(cell);
	}
}

function addBomCostsGroupedHeaders(table) {
	const headerRow = getTableHeaderRow(table);
	if (!headerRow) return;

	const headerParent = headerRow.parentElement;
	const groupDefinitions = [
		{ name: 'Budget', lead: 'DESIGN LEAD TIME (WEEKS)', unit: 'DESIGN COST PER UNIT (CAD)', extended: 'EXT. DESIGN COST (CAD)' },
		{ name: 'Last', lead: 'PURCHASE LEAD TIME (WEEKS)', unit: 'PURCHASE COST PER UNIT (CAD)', extended: 'EXT. PURCHASE COST (CAD)' }
	].filter((group) =>
		findTableColumnIndex(table, group.lead) >= 0 &&
		findTableColumnIndex(table, group.unit) >= 0 &&
		findTableColumnIndex(table, group.extended) >= 0
	);
	const hasDelta = findTableColumnIndex(table, BOM_COST_DELTA_COLUMN) >= 0;
	const hasCostUom = findTableColumnIndex(table, BOM_COST_UOM_COLUMN) >= 0;
	const hasLeadTimeDelta = findTableColumnIndex(table, BOM_LEAD_TIME_DELTA_COLUMN) >= 0;
	const signature = `${groupDefinitions.map((group) => group.name).join('|')}|leadDelta:${hasLeadTimeDelta}|delta:${hasDelta}|uom:${hasCostUom}`;
	const existingGroupRows = Array.from(headerParent.children).filter((row) =>
		row.dataset?.bomCostGroupHeader
	);
	if (existingGroupRows.length &&
		existingGroupRows[0].dataset.bomCostGroupSignature === signature) return;
	for (const row of existingGroupRows) row.remove();
	headerRow.style.display = '';

	if (!groupDefinitions.length) return;

	const columnGroups = [
		{
			title: 'Lead Times (Weeks)',
			columns: [
				...groupDefinitions.map((group) => ({
					name: group.name === 'Budget' ? 'Design' : group.name,
					field: group.lead
				})),
				...(findTableColumnIndex(table, BOM_LEAD_TIME_DELTA_COLUMN) >= 0
					? [{ name: 'Delta', field: BOM_LEAD_TIME_DELTA_COLUMN }]
					: [])
			]
		},
		{
			title: 'Total Ext. Costs ($CAD)',
			columns: [
				...groupDefinitions.map((group) => ({ name: group.name, field: group.extended })),
				...(hasDelta ? [{ name: 'Delta ($)', field: BOM_COST_DELTA_COLUMN }] : [])
			]
		},
		{
			title: 'Cost/UoM ($CAD)',
			columns: [
				...groupDefinitions.map((group) => ({ name: group.name, field: group.unit })),
				...(hasCostUom ? [{ name: 'UoM', field: BOM_COST_UOM_COLUMN }] : [])
			]
		}
	];
	const fieldGroups = new Map();
	for (const group of columnGroups) {
		for (const column of group.columns) fieldGroups.set(column.field, group);
	}
	const topRow = document.createElement('tr');
	const subRow = document.createElement('tr');
	for (const row of [topRow, subRow]) {
		row.dataset.bomCostGroupHeader = 'true';
		row.dataset.bomCostGroupSignature = signature;
	}

	const appendedGroups = new Set();
	for (const sourceCell of headerRow.cells) {
		const columnName = sourceCell.textContent.trim().replace(/\s+/g, ' ').toUpperCase();
		const columnGroup = fieldGroups.get(columnName);
		if (!columnGroup) {
			const headerText = columnName === 'ITEM-WEIGHT(KG)'
				? 'Weight (kg)'
				: columnName === 'DESCRIPTION' ? 'Description' : sourceCell.textContent;
			const topCell = createBomCostsHeaderCell(sourceCell, headerText);
			topCell.rowSpan = 2;
			topRow.appendChild(topCell);
			continue;
		}
		if (appendedGroups.has(columnGroup)) continue;

		appendedGroups.add(columnGroup);
		const groupCell = createBomCostsHeaderCell(sourceCell, columnGroup.title);
		groupCell.colSpan = columnGroup.columns.length;
		if (columnGroup.title === 'Lead Times (Weeks)') groupCell.style.whiteSpace = 'nowrap';
		topRow.appendChild(groupCell);
		for (const column of columnGroup.columns) {
			const subCell = headerRow.cells[findTableColumnIndex(table, column.field)];
			subRow.appendChild(createBomCostsHeaderCell(subCell, column.name));
		}
	}

	if (topRow.cells.length && subRow.cells.length) {
		headerParent.insertBefore(topRow, headerRow);
		headerParent.insertBefore(subRow, headerRow);
		headerRow.style.display = 'none';
	}
}

function createBomCostsHeaderCell(sourceCell, text) {
	const cell = sourceCell.cloneNode(false);
	cell.removeAttribute('id');
	cell.removeAttribute('width');
	cell.style.width = '';
	cell.style.whiteSpace = 'normal';
	cell.rowSpan = 1;
	cell.colSpan = 1;
	cell.textContent = text;
	return cell;
}

function sizeBomCostsColumns(table, columnNames) {
	const headerRow = getTableHeaderRow(table);
	if (!headerRow) return;
	const totalsRow = Array.from(table.rows).find((row) =>
		Array.from(row.cells).some((cell) =>
			cell.textContent.trim().replace(/\s+/g, ' ').toUpperCase() === 'TOTAL(S):'
		)
	);
	for (const columnName of columnNames) {
		const columnIndex = findTableColumnIndex(table, columnName);
		if (columnIndex < 0) continue;

		const headerCell = headerRow.cells[columnIndex];
		headerCell.style.width = '';
		headerCell.style.whiteSpace = 'normal';
		let widestDataCell = 0;
		for (const row of table.rows) {
			if (row === headerRow || row === totalsRow || row.dataset.bomCostGroupHeader) continue;
			const cell = getBomCostsCell(table, row, columnName);
			if (!cell) continue;
			cell.style.width = '';
			cell.style.whiteSpace = 'nowrap';
			widestDataCell = Math.max(widestDataCell, cell.scrollWidth);
		}
		if (widestDataCell) headerCell.style.width = `${widestDataCell}px`;
	}
}

function startTitleUpdates() {
	updateTitle();
	updateBomTableColumns();
	registerPartialPostbackUpdates();
	window.addEventListener('load', registerPartialPostbackUpdates, { once: true });
	chrome.storage.sync.get(ITEM_BOM_FEATURES_SETTING)
		.then((settings) => {
			itemBomFeaturesEnabled = settings[ITEM_BOM_FEATURES_SETTING] !== false;
			itemBomFeaturesSettingLoaded = true;
			updateBomTableColumns();
		})
		.catch((error) => {
			console.error('Could not load Item BOM feature setting:', error);
			itemBomFeaturesSettingLoaded = true;
			updateBomTableColumns();
		});
	chrome.storage.sync.get(BOM_COST_FEATURES_SETTING)
		.then((settings) => {
			bomCostRollupFeaturesEnabled = settings[BOM_COST_FEATURES_SETTING] !== false;
			bomCostRollupSettingLoaded = true;
			updateBomTableColumns();
		})
		.catch((error) => {
			console.error('Could not load BOM cost rollup feature setting:', error);
			bomCostRollupSettingLoaded = true;
			updateBomTableColumns();
		});
	chrome.storage.onChanged.addListener((changes, areaName) => {
		if (areaName !== 'sync') return;
		const path = window.location.pathname.toLowerCase();
		if (changes[BOM_COST_FEATURES_SETTING] &&
			path.includes('/apps/desktop/item/reports/bomcosts')) {
			window.location.reload();
		} else if (changes[ITEM_BOM_FEATURES_SETTING] &&
			document.querySelector(SELECTORS.itemBomTable)) {
			window.location.reload();
		}
	});
	const pageTitle = document.querySelector(SELECTORS.pageTitle);
	if (pageTitle) new MutationObserver(updateTitle).observe(pageTitle, { childList: true, subtree: true });
	if (document.body) {
		const observerOptions = {
			childList: true,
			characterData: true,
			subtree: true
		};
		let pendingUpdate = null;
		let recentUpdates = [];
		let reconnecting = false;
		const observer = new MutationObserver(() => {
			if (pendingUpdate !== null) window.clearTimeout(pendingUpdate);
			pendingUpdate = window.setTimeout(() => {
				pendingUpdate = null;
				if (reconnecting) return;
				reconnecting = true;
				observer.disconnect();
				try {
					const now = Date.now();
					const path = window.location.pathname.toLowerCase();
					const isBomCostsPage = path.includes('/apps/desktop/item/reports/bomcosts');
					if (isBomCostsPage && document.querySelector(SELECTORS.bomCostsTable)) {
						recentUpdates = recentUpdates.filter((timestamp) => now - timestamp < 10000);
						recentUpdates.push(now);
						if (recentUpdates.length >= 50 && reloadAfterMutationStorm()) return;
					}
					updateBomTableColumns();
				} finally {
					reconnecting = false;
					if (document.body?.isConnected) observer.observe(document.body, observerOptions);
				}
			}, 100);
		});
		observer.observe(document.body, observerOptions);
	}
}

function registerPartialPostbackUpdates() {
	const pageRequestManager = globalThis.Sys?.WebForms?.PageRequestManager?.getInstance?.();
	if (!pageRequestManager || globalThis.__omnifyTitleTabsPostbackHandlerRegistered) return;

	pageRequestManager.add_endRequest(() => {
		updateTitle();
		updateBomTableColumns();
	});
	globalThis.__omnifyTitleTabsPostbackHandlerRegistered = true;
}

function reloadAfterMutationStorm() {
	const recoveryKey = '__omnifyTitleTabsLastRecovery';
	const now = Date.now();
	try {
		const lastRecovery = Number(sessionStorage.getItem(recoveryKey) || 0);
		if (now - lastRecovery < 60000) return false;
		sessionStorage.setItem(recoveryKey, String(now));
		window.location.reload();
		return true;
	} catch (error) {
		console.error('Could not recover the BOMCosts page after repeated updates:', error);
		return false;
	}
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', startTitleUpdates, { once: true });
} else {
	startTitleUpdates();
}
})();
