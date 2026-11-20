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
	bomFieldCheckTable: '#CPMainPage_dgProposedBOM',
	bomFieldCheckSelector: '#CPMenuBar_dlToolbar_FieldName',
	bomFieldCheckReturnToolbarCell: '#CPMainPage_td_Change_Report_Toolbar_Return',
	itemBomHeader: '#CPMainPage_frmBOM_lbl_Item_BOM_Header',
    ecoItemChangesPane: '#CPMainPage_frmSubTitleCommon_frmSubTitleMenu_lblMainMenu_Text > b',
	ecoAllBomChangesTable: '#CPMainPage_frmBOMChanges_dgRedlines_BOMChanges_All',
	ecoItemBomChangesTable: '#CPMainPage_frmBOMChanges_dgRedlines_BOMChanges_Item',
	projectName: '#CPMainPage_frmSubTitleCommon_frmSubTitleMenu_lblMainMenu_Text',
	projectDescription: '#CPMainPage_frmGeneral_dgGeneralFields_lblGeneralPage_Field_Value_1'
});
const QUICK_SEARCH_TARGETS = [
	{ label: 'Items', objectType: 0 },
	{ label: 'ECOs', objectType: 1 },
	{ label: 'Vendor Items', objectType: 3 },
	{ label: 'Vendors', objectType: 6 },
	{ label: 'CAPAs', objectType: 5 },
	{ label: 'Projects', objectType: 2 }
];
const BOM_COST_DELTA_COLUMN = 'DELTA ($)';
const BOM_COST_UNIT_DELTA_COLUMN = 'UNIT COST DELTA ($CAD)';
const BOM_COST_UOM_COLUMN = 'COST UOM';
const BOM_LEAD_TIME_DELTA_COLUMN = 'LEAD TIME DELTA';
const BOM_COST_FEATURES_SETTING = 'bomCostRollupFeaturesEnabled';
const ITEM_BOM_FEATURES_SETTING = 'itemBomFeaturesEnabled';
const BOM_FIELD_CHECK_ATTRIBUTES = [
	'DESIGN COST PER UNIT (CAD)',
	'DESIGN LEAD TIME (WEEKS)',
	'PURCHASE COST PER UNIT (CAD)',
	'PURCHASE LEAD TIME (WEEKS)',
	'UNIT OF MEASURE',
	'ITEM-WEIGHT(KG)'
];
const BOM_FIELD_CHECK_OUTPUT_COLUMNS = [
	{ name: 'DESIGN LEAD TIME (WEEKS)', attribute: 'DESIGN LEAD TIME (WEEKS)' },
	{ name: 'PURCHASE LEAD TIME (WEEKS)', attribute: 'PURCHASE LEAD TIME (WEEKS)' },
	{ name: 'LEAD TIME DELTA', calculation: 'leadTimeDelta' },
	{ name: 'EXT. DESIGN COST (CAD)', calculation: 'extendedDesignCost' },
	{ name: 'EXT. PURCHASE COST (CAD)', calculation: 'extendedPurchaseCost' },
	{ name: 'EXT. COST DELTA ($CAD)', calculation: 'extendedCostDelta' },
	{ name: 'DESIGN COST PER UNIT (CAD)', attribute: 'DESIGN COST PER UNIT (CAD)' },
	{ name: 'PURCHASE COST PER UNIT (CAD)', attribute: 'PURCHASE COST PER UNIT (CAD)' },
	{ name: 'UNIT COST DELTA ($CAD)', calculation: 'unitCostDelta' },
	{ name: 'COST UOM', attribute: 'UNIT OF MEASURE' },
	{ name: 'UNIT OF MEASURE', attribute: 'UNIT OF MEASURE' },
	{ name: 'ITEM-WEIGHT(KG)', attribute: 'ITEM-WEIGHT(KG)' }
];
const BOM_FIELD_CHECK_STORAGE_KEY = '__omnifyTitleTabsBomFieldCheckRollup';
const bomFieldCheckValueBuffer = new WeakMap();
const DRAWING_VIEW_COLUMNS = ['Refdes', 'Qty', 'UoM', 'Part Number', 'Rev', 'Description'];
const DRAWING_VIEW_COLUMN_ORDER = [
	'Refdes', 'Qty', 'UoM', 'Part Number', 'Rev', 'Current Rev', 'Description'
];
const ECO_DRAWING_VIEW_COLUMN_ORDER = [
	'Find', 'Refdes', 'Qty', 'UoM', 'Part Number', 'Rev', 'Description', 'Vendors'
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

	const headerRow = getTableHeaderRow(table);
	if (headerRow) {
		const headerCell = headerRow.cells[columnIndex];
		if (headerCell) headerCell.style.whiteSpace = 'nowrap';
	}
	for (const row of table.rows) {
		if (row === getTableHeaderRow(table) ||
			row.dataset.bomCostGroupHeader ||
			row.dataset.omnifyBomRevisionGroupHeader) continue;
		const cell = table.id === 'CPMainPage_dgBOM'
			? getBomCostsCell(table, row, columnName)
			: row.cells[columnIndex];
		if (cell) cell.style.whiteSpace = 'nowrap';
	}
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
			!row.dataset.omnifyBomRevisionGroupHeader &&
			!row.dataset.omnifyBomFieldCheckGroupHeader
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
	if (itemBomFeaturesSettingLoaded) addEcoDrawingViewControl();

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
	if (window.location.pathname.toLowerCase().includes('/apps/desktop/change/reports/bomfieldcheck')) {
		if (addBomFieldCheckCostRollupControl()) return;
		formatBomFieldCheckTable();
		const bomFieldCheckTable = document.querySelector(SELECTORS.bomFieldCheckTable);
		if (bomFieldCheckTable?.dataset.omnifyBomFieldCheckCostRollup) {
			addBomFieldCheckContributorControl(bomFieldCheckTable);
			updateBomFieldCheckContributorHighlight(bomFieldCheckTable);
		}
	}
}

function formatBomFieldCheckTable() {
	const table = document.querySelector(SELECTORS.bomFieldCheckTable);
	if (!table) return;
	if (table.dataset.omnifyBomFieldCheckGroupedHeaders) return;
	updateNoWrapColumnWidth(table, 'Description');
	moveTableColumnAfter(table, 'UoM', 'Qty');
}

function addBomFieldCheckCostRollupControl() {
	const table = document.querySelector(SELECTORS.bomFieldCheckTable);

	let button = document.getElementById('omnify-bom-field-check-cost-rollup');
	if (!button) {
		const returnToolbarCell = document.querySelector(SELECTORS.bomFieldCheckReturnToolbarCell);
		if (!returnToolbarCell) return false;

		const toolbarCell = returnToolbarCell.cloneNode(false);
		toolbarCell.removeAttribute('id');
		toolbarCell.removeAttribute('title');
		toolbarCell.removeAttribute('onclick');
		button = document.createElement('button');
		button.id = 'omnify-bom-field-check-cost-rollup';
		button.type = 'button';
		button.setAttribute('aria-disabled', 'false');
		button.textContent = 'Cost Rollup';
		button.style.marginLeft = '6px';
		button.addEventListener('click', startBomFieldCheckCostRollup);
		button.addEventListener('keydown', (event) => {
			if (event.key !== 'Enter' && event.key !== ' ') return;
			event.preventDefault();
			startBomFieldCheckCostRollup();
		});
		toolbarCell.appendChild(button);
		returnToolbarCell.after(toolbarCell);
	}

	try {
		const workflow = loadBomFieldCheckWorkflow();
		if (workflow?.active) {
			const label = workflow.phase === 'reset'
				? 'Preparing...'
				: `Loading ${workflow.index + 1}/6...`;
			setBomFieldCheckButtonState(label, true);
			resumeBomFieldCheckCostRollup();
			return true;
		}
	} catch (error) {
		console.error('Could not inspect BOM Field Check Cost Rollup state:', error);
		setBomFieldCheckButtonState('Cost Rollup (error)', false);
		return true;
	}

	if (table?.dataset.omnifyBomFieldCheckCostRollup) {
		setBomFieldCheckButtonState('Cost Rollup', true);
		return false;
	}
	resumeBomFieldCheckCostRollup();
	return false;
}

function getBomFieldCheckWorkflowKey() {
	return `${BOM_FIELD_CHECK_STORAGE_KEY}:${window.location.pathname}`;
}

function clearBomFieldCheckWorkflowsOutsideReport() {
	if (window.location.pathname.toLowerCase().includes('/apps/desktop/change/reports/bomfieldcheck')) return;
	try {
		const keyPrefix = `${BOM_FIELD_CHECK_STORAGE_KEY}:`;
		for (let index = sessionStorage.length - 1; index >= 0; index--) {
			const key = sessionStorage.key(index);
			if (key?.startsWith(keyPrefix)) sessionStorage.removeItem(key);
		}
	} catch (error) {
		console.error('Could not clear the inactive BOM Field Check Cost Rollup state:', error);
	}
}

function loadBomFieldCheckWorkflow() {
	const serializedWorkflow = sessionStorage.getItem(getBomFieldCheckWorkflowKey());
	return serializedWorkflow ? JSON.parse(serializedWorkflow) : null;
}

function saveBomFieldCheckWorkflow(workflow) {
	sessionStorage.setItem(getBomFieldCheckWorkflowKey(), JSON.stringify(workflow));
}

function setBomFieldCheckButtonState(label, disabled) {
	const button = document.getElementById('omnify-bom-field-check-cost-rollup');
	if (!button) return;
	button.textContent = label;
	button.disabled = disabled;
}

function isBomFieldCheckPostbackActive() {
	return document.documentElement?.getAttribute('data-omnify-title-tabs-async-postback') === 'true';
}

function startBomFieldCheckCostRollup() {
	const button = document.getElementById('omnify-bom-field-check-cost-rollup');
	if (!button || button.disabled) return;

	try {
		const workflow = {
			active: true,
			phase: 'reset',
			index: 0,
			captures: [],
			awaitingPageLoad: false
		};
		saveBomFieldCheckWorkflow(workflow);
		globalThis.__omnifyBomFieldCheckResumeStarted = true;
		setBomFieldCheckButtonState('Preparing...', true);
		continueBomFieldCheckCostRollup(workflow);
	} catch (error) {
		console.error('Could not start BOM Field Check Cost Rollup:', error);
		setBomFieldCheckButtonState('Cost Rollup (error)', false);
	}
}

function resumeBomFieldCheckCostRollup() {
	let workflow;
	try {
		workflow = loadBomFieldCheckWorkflow();
	} catch (error) {
		console.error('Could not restore BOM Field Check Cost Rollup:', error);
		setBomFieldCheckButtonState('Cost Rollup (error)', false);
		return;
	}
	if (!workflow?.active) return;

	const label = workflow.phase === 'reset'
		? 'Preparing...'
		: `Loading ${workflow.index + 1}/6...`;
	setBomFieldCheckButtonState(label, true);
	if (globalThis.__omnifyBomFieldCheckResumeStarted) return;
	if (!document.querySelector(SELECTORS.bomFieldCheckSelector) ||
		!document.querySelector(SELECTORS.bomFieldCheckTable)) return;
	globalThis.__omnifyBomFieldCheckResumeStarted = true;

	if (!workflow.awaitingPageLoad) {
		try {
			sessionStorage.removeItem(getBomFieldCheckWorkflowKey());
		} catch (error) {
			console.error('Could not clear the incomplete BOM Field Check Cost Rollup state:', error);
		}
		setBomFieldCheckButtonState('Cost Rollup', false);
		return;
	}

	if (workflow.awaitingPageLoad) {
		const resumeAfterPageLoad = (attempt = 0) => {
			try {
				const currentWorkflow = loadBomFieldCheckWorkflow();
				if (!currentWorkflow?.active || !currentWorkflow.awaitingPageLoad) return;
				if (isBomFieldCheckPostbackActive() && attempt < 150) {
					window.setTimeout(() => resumeAfterPageLoad(attempt + 1), 200);
					return;
				}
				if (isBomFieldCheckPostbackActive()) {
					throw new Error('Timed out waiting for the Proposed BOM update to finish.');
				}
				finishBomFieldCheckPostback(currentWorkflow);
			} catch (error) {
				failBomFieldCheckCostRollup(error);
			}
		};
		window.setTimeout(() => resumeAfterPageLoad(), 500);
		return;
	}
	continueBomFieldCheckCostRollup(workflow);
}

function finishBomFieldCheckPostback(workflow) {
	workflow.awaitingPageLoad = false;
	workflow.waitingForPostback = false;
	if (workflow.phase === 'reset') {
		workflow.phase = 'rollup';
		workflow.attributeLoadRetries = 0;
		saveBomFieldCheckWorkflow(workflow);
		continueBomFieldCheckCostRollup(workflow);
		return;
	}
	saveBomFieldCheckWorkflow(workflow);
	captureBomFieldCheckAttribute(workflow);
}

function getBomFieldCheckOption(selector, attribute) {
	if (!selector) return null;
	const expectedLabel = normalizeBomFieldCheckOptionLabel(attribute);
	return Array.from(selector.options).find((option) =>
		normalizeBomFieldCheckOptionLabel(option.textContent) === expectedLabel
	) || null;
}

function normalizeBomFieldCheckOptionLabel(label) {
	return label
		.replace(/^ATTRIBUTE\s*:\s*/i, '')
		.replace(/[^A-Z0-9]/gi, '')
		.toUpperCase();
}

function isBomFieldCheckOptionSelected(selector, option, attribute) {
	const selectedOption = selector?.options?.[selector.selectedIndex];
	return selectedOption === option ||
		normalizeBomFieldCheckOptionLabel(selectedOption?.textContent || '') ===
			normalizeBomFieldCheckOptionLabel(attribute);
}

function continueBomFieldCheckCostRollup(workflow, postbackWaitStartedAt = Date.now()) {
	if (!workflow.active) return;
	if (isBomFieldCheckPostbackActive()) {
		if (Date.now() - postbackWaitStartedAt >= 30000) {
			failBomFieldCheckCostRollup(new Error('Timed out waiting for the current Proposed BOM update.'));
			return;
		}
		window.setTimeout(() =>
			continueBomFieldCheckCostRollup(workflow, postbackWaitStartedAt),
		100);
		return;
	}

	if (workflow.phase === 'reset') {
		const selector = document.querySelector(SELECTORS.bomFieldCheckSelector);
		const lifecycleOption = getBomFieldCheckOption(selector, 'LIFECYCLE');
		if (!selector || !lifecycleOption) {
			failBomFieldCheckCostRollup(new Error('Could not find the "Lifecycle" option.'));
			return;
		}
		if (isBomFieldCheckOptionSelected(selector, lifecycleOption, 'LIFECYCLE')) {
			workflow.phase = 'rollup';
			saveBomFieldCheckWorkflow(workflow);
			continueBomFieldCheckCostRollup(workflow);
			return;
		}

		setBomFieldCheckButtonState('Preparing...', true);
		requestBomFieldCheckOption(workflow, selector, lifecycleOption);
		return;
	}
	if (!workflow.phase) workflow.phase = 'rollup';

	if (workflow.index >= BOM_FIELD_CHECK_ATTRIBUTES.length) {
		completeBomFieldCheckCostRollup(workflow);
		return;
	}

	const selector = document.querySelector(SELECTORS.bomFieldCheckSelector);
	const attribute = BOM_FIELD_CHECK_ATTRIBUTES[workflow.index];
	const option = getBomFieldCheckOption(selector, attribute);
	if (!selector || !option) {
		failBomFieldCheckCostRollup(new Error(`Could not find the "${attribute}" option.`));
		return;
	}

	setBomFieldCheckButtonState(`Loading ${workflow.index + 1}/6...`, true);
	if (isBomFieldCheckOptionSelected(selector, option, attribute)) {
		captureBomFieldCheckAttribute(workflow);
		return;
	}

	requestBomFieldCheckOption(workflow, selector, option);
}

function requestBomFieldCheckOption(workflow, selector, option) {
	if (!document.querySelector(SELECTORS.bomFieldCheckTable)) {
		failBomFieldCheckCostRollup(new Error('The Proposed BOM table is not available.'));
		return;
	}
	workflow.awaitingPageLoad = true;
	workflow.waitingForPostback = true;
	saveBomFieldCheckWorkflow(workflow);
	selector.value = option.value;
	selector.dispatchEvent(new Event('change', { bubbles: true }));
	saveBomFieldCheckWorkflow(workflow);
}

function captureBomFieldCheckAttribute(
	workflow,
	postbackWaitStartedAt = Date.now()
) {
	if (!workflow.active || workflow.waitingForPostback) return;
	if (isBomFieldCheckPostbackActive()) {
		if (Date.now() - postbackWaitStartedAt >= 30000) {
			failBomFieldCheckCostRollup(new Error('Timed out waiting for the selected attribute to load.'));
			return;
		}
		window.setTimeout(() =>
			captureBomFieldCheckAttribute(workflow, postbackWaitStartedAt),
		100);
		return;
	}
	const table = document.querySelector(SELECTORS.bomFieldCheckTable);
	const headerRow = table && Array.from(table.rows).find((row) =>
		Array.from(row.cells).some((cell) =>
			normalizeBomColumnName(cell.textContent) === 'FIELD'
		)
	);
	if (!table || !headerRow) {
		failBomFieldCheckCostRollup(new Error('Could not read the Proposed BOM table headers.'));
		return;
	}

	const fieldIndex = Array.from(headerRow.cells).findIndex((cell) =>
		normalizeBomColumnName(cell.textContent) === 'FIELD'
	);
	const oldValueIndex = Array.from(headerRow.cells).findIndex((cell) =>
		normalizeBomColumnName(cell.textContent) === 'OLD VALUE'
	);
	const newValueIndex = Array.from(headerRow.cells).findIndex((cell) =>
		normalizeBomColumnName(cell.textContent) === 'NEW VALUE'
	);
	if (fieldIndex < 0 || oldValueIndex < 0 || newValueIndex < 0) {
		failBomFieldCheckCostRollup(new Error('The Proposed BOM table is missing Field, Old Value, or New Value.'));
		return;
	}

	const rows = Array.from(table.rows)
		.slice(Array.from(table.rows).indexOf(headerRow) + 1)
		.filter((row) => row.cells.length > Math.max(fieldIndex, oldValueIndex, newValueIndex));
	const expectedField = BOM_FIELD_CHECK_ATTRIBUTES[workflow.index];
	const normalizeCapturedField = (field) => field
		.replace(/^ATTRIBUTE\s*:\s*/i, '')
		.replace(/[^A-Z0-9]/gi, '')
		.toUpperCase();
	const expectedFieldName = normalizeCapturedField(expectedField);
	const hasMatchingField = rows.some((row) => {
		const field = row.cells[fieldIndex].textContent.trim().replace(/\s+/g, ' ');
		return field && normalizeCapturedField(field) === expectedFieldName;
	});
	if (!hasMatchingField) {
		if ((workflow.attributeLoadRetries || 0) >= 15) {
			workflow.attributeLoadRetries = 0;
			failBomFieldCheckCostRollup(new Error(
				`The Proposed BOM did not show the "${expectedField}" field after the dropdown postback.`
			));
			return;
		}
		workflow.attributeLoadRetries = (workflow.attributeLoadRetries || 0) + 1;
		saveBomFieldCheckWorkflow(workflow);
		window.setTimeout(() => captureBomFieldCheckAttribute(workflow), 200);
		return;
	}
	workflow.attributeLoadRetries = 0;
	const values = rows.map((row) => {
		const field = row.cells[fieldIndex].textContent.trim().replace(/\s+/g, ' ').toUpperCase();
		const matchesAttribute = !field ||
			normalizeCapturedField(field) === expectedFieldName;
		return {
			oldValue: matchesAttribute ? row.cells[oldValueIndex].textContent.trim() : '',
			newValue: matchesAttribute ? row.cells[newValueIndex].textContent.trim() : ''
		};
	});
	workflow.captures[workflow.index] = values;
	workflow.index++;
	workflow.awaitingPageLoad = false;
	workflow.waitingForPostback = false;
	try {
		saveBomFieldCheckWorkflow(workflow);
		continueBomFieldCheckCostRollup(workflow);
	} catch (error) {
		failBomFieldCheckCostRollup(error);
	}
}

function getBomFieldCheckCapturedValue(workflow, rowIndex, attribute) {
	const attributeIndex = BOM_FIELD_CHECK_ATTRIBUTES.indexOf(attribute);
	return workflow.captures[attributeIndex]?.[rowIndex]?.newValue || '';
}

function setBomFieldCheckLeadTimeDeltaValue(cell, value) {
	const difference = Number(value.toFixed(10));
	if (difference === 0) {
		cell.textContent = '';
		cell.style.color = '';
		return;
	}

	cell.textContent = `${difference > 0 ? '+' : '-'}${formatLeadTime(String(Math.abs(difference)))}`;
	cell.style.color = difference > 0 ? 'red' : 'green';
}

function completeBomFieldCheckCostRollup(workflow) {
	try {
		const table = document.querySelector(SELECTORS.bomFieldCheckTable);
		const headerRow = table && Array.from(table.rows).find((row) =>
			Array.from(row.cells).some((cell) =>
				normalizeBomColumnName(cell.textContent) === 'FIELD'
			)
		);
		if (!table || !headerRow) throw new Error('Could not update the Proposed BOM table.');

		const sourceHeaderCells = Array.from(headerRow.cells);
		const oldValueIndex = sourceHeaderCells.findIndex((cell) =>
			normalizeBomColumnName(cell.textContent) === 'OLD VALUE'
		);
		const quantityIndex = sourceHeaderCells.findIndex((cell) =>
			normalizeBomColumnName(cell.textContent) === 'QTY'
		);
		const firstDataRowIndex = Array.from(table.rows).indexOf(headerRow) + 1;
		const dataRows = Array.from(table.rows).slice(firstDataRowIndex)
			.filter((row) => row.cells.length > oldValueIndex);
		if (oldValueIndex < 0 || quantityIndex < 0 ||
			workflow.captures.some((capture) => capture.length !== dataRows.length)) {
			throw new Error('The Proposed BOM rows changed while collecting attribute values.');
		}

		const activeColumnIndexes = ['FIELD', 'OLD VALUE', 'NEW VALUE']
			.map((columnName) => sourceHeaderCells.findIndex((cell) =>
				normalizeBomColumnName(cell.textContent) === columnName
			))
			.filter((index) => index >= 0)
			.sort((left, right) => right - left);
		for (const row of [headerRow, ...dataRows]) {
			for (const columnIndex of activeColumnIndexes) {
				row.cells[columnIndex]?.remove();
			}
		}

		const headerSourceCell = headerRow.cells[0];

		for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex++) {
			for (const column of BOM_FIELD_CHECK_OUTPUT_COLUMNS) {
				const cell = dataRows[rowIndex].cells[0].cloneNode(false);
				cell.removeAttribute('id');
				cell.dataset.omnifyBomFieldCheckColumn = column.name;
				if (column.attribute) {
					const capturedValue = getBomFieldCheckCapturedValue(
						workflow,
						rowIndex,
						column.attribute
					);
					cell.textContent = capturedValue &&
						['DESIGN COST PER UNIT (CAD)', 'PURCHASE COST PER UNIT (CAD)']
							.includes(column.attribute)
						? formatCurrency(capturedValue)
						: capturedValue;
				} else {
					const quantity = parseCurrencyValue(dataRows[rowIndex].cells[quantityIndex].textContent);
					const designCost = parseCurrencyValue(getBomFieldCheckCapturedValue(
						workflow,
						rowIndex,
						'DESIGN COST PER UNIT (CAD)'
					));
					const purchaseCost = parseCurrencyValue(getBomFieldCheckCapturedValue(
						workflow,
						rowIndex,
						'PURCHASE COST PER UNIT (CAD)'
					));
					const designLeadTime = parseLeadTimeValue(getBomFieldCheckCapturedValue(
						workflow,
						rowIndex,
						'DESIGN LEAD TIME (WEEKS)'
					));
					const purchaseLeadTime = parseLeadTimeValue(getBomFieldCheckCapturedValue(
						workflow,
						rowIndex,
						'PURCHASE LEAD TIME (WEEKS)'
					));
					const difference = column.calculation === 'leadTimeDelta'
						? designLeadTime === null || purchaseLeadTime === null
							? null
							: purchaseLeadTime - designLeadTime
						: column.calculation === 'unitCostDelta'
							? designCost === null || purchaseCost === null
								? null
								: purchaseCost - designCost
							: quantity === null || designCost === null || purchaseCost === null
								? null
								: column.calculation === 'extendedDesignCost'
									? quantity * designCost
									: column.calculation === 'extendedPurchaseCost'
										? quantity * purchaseCost
										: quantity * (purchaseCost - designCost);
					if (difference !== null) {
						if (column.calculation === 'leadTimeDelta') {
							setBomFieldCheckLeadTimeDeltaValue(cell, difference);
						} else if (column.calculation === 'unitCostDelta' ||
							column.calculation === 'extendedCostDelta') {
							setBomCostsDeltaValue(cell, difference);
						} else {
							cell.textContent = formatCurrency(String(difference));
						}
					}
				}
				dataRows[rowIndex].appendChild(cell);
			}
		}
		for (const column of BOM_FIELD_CHECK_OUTPUT_COLUMNS) {
			const headerCell = headerSourceCell.cloneNode(false);
			headerCell.removeAttribute('id');
			headerCell.rowSpan = 1;
			headerCell.colSpan = 1;
			if (column.attribute && column.name !== 'COST UOM') {
				headerCell.dataset.omnifyBomFieldCheckAttribute = column.attribute;
			}
			headerCell.dataset.omnifyBomFieldCheckColumn = column.name;
			headerCell.textContent = column.name === 'UNIT OF MEASURE'
				? 'UoM'
				: column.name;
			headerRow.appendChild(headerCell);
		}
		addBomFieldCheckInclusionColumn(table);
		bomFieldCheckValueBuffer.set(table, {
			attributes: BOM_FIELD_CHECK_ATTRIBUTES,
			rows: workflow.captures.map((capture, attributeIndex) =>
				capture.map((values) => ({
					attribute: BOM_FIELD_CHECK_ATTRIBUTES[attributeIndex],
					oldValue: values.oldValue,
					newValue: values.newValue
				}))
			)
		});
		formatBomFieldCheckTable();
		addBomFieldCheckGroupedHeaders(table);
		updateBomFieldCheckTotalsRow(table);
		table.dataset.omnifyBomFieldCheckCostRollup = 'true';
		addBomFieldCheckContributorControl(table);
		updateBomFieldCheckContributorHighlight(table);
		sessionStorage.removeItem(getBomFieldCheckWorkflowKey());
		setBomFieldCheckButtonState('Cost Rollup', true);
	} catch (error) {
		failBomFieldCheckCostRollup(error);
	}
}

function addBomFieldCheckInclusionColumn(table) {
	const headerRow = getTableHeaderRow(table);
	if (!headerRow?.parentElement) {
		throw new Error('Could not add the Proposed BOM totals checkboxes.');
	}

	let headerCell = headerRow.cells[0];
	if (!headerCell?.dataset.omnifyBomFieldCheckIncludeColumn) {
		headerCell = headerCell.cloneNode(false);
		headerCell.removeAttribute('id');
		headerCell.dataset.omnifyBomFieldCheckIncludeColumn = 'true';
		headerCell.textContent = 'Include';
		headerCell.style.textAlign = 'center';
		headerCell.style.whiteSpace = 'nowrap';
		headerRow.insertBefore(headerCell, headerRow.firstChild);
	}

	const partNumberIndex = Array.from(headerRow.cells).findIndex((cell) =>
		cell.dataset.omnifyBomFieldCheckColumn === 'PART NUMBER' ||
		normalizeBomColumnName(cell.textContent) === 'PART NUMBER'
	);
	for (const row of table.rows) {
		if (row === headerRow || row.dataset.omnifyBomFieldCheckGroupHeader ||
			row.dataset.omnifyBomFieldCheckTotalRow || row.cells.length !== headerRow.cells.length - 1) {
			continue;
		}

		const cell = row.cells[0].cloneNode(false);
		cell.removeAttribute('id');
		cell.style.textAlign = 'center';
		cell.style.whiteSpace = 'nowrap';
		const partNumber = partNumberIndex > 0
			? row.cells[partNumberIndex - 1]?.textContent.trim()
			: '';
		const checkbox = document.createElement('input');
		checkbox.type = 'checkbox';
		checkbox.checked = true;
		checkbox.setAttribute(
			'aria-label',
			partNumber ? `Include ${partNumber} in totals` : 'Include row in totals'
		);
		checkbox.dataset.omnifyBomFieldCheckInclude = 'true';
		checkbox.addEventListener('change', () => {
			updateBomFieldCheckTotalsRow(table);
			updateBomFieldCheckContributorHighlight(table);
		});
		cell.appendChild(checkbox);
		row.insertBefore(cell, row.firstChild);
	}
}

function addBomFieldCheckGroupedHeaders(table) {
	const headerRow = getTableHeaderRow(table);
	if (!headerRow?.parentElement) {
		throw new Error('Could not build the Proposed BOM lead-time headers.');
	}

	const sourceCells = Array.from(headerRow.cells);
	const topRow = document.createElement('tr');
	const subRow = document.createElement('tr');
	topRow.dataset.omnifyBomFieldCheckGroupHeader = 'true';
	subRow.dataset.omnifyBomFieldCheckGroupHeader = 'true';
	const groupDefinitions = [
		{
			title: 'Lead Times (Weeks)',
			columns: [
				'DESIGN LEAD TIME (WEEKS)',
				'PURCHASE LEAD TIME (WEEKS)',
				'LEAD TIME DELTA'
			],
			labels: ['Design', 'Last', 'Delta']
		},
		{
			title: 'Total Ext. Costs ($CAD)',
			columns: [
				'EXT. DESIGN COST (CAD)',
				'EXT. PURCHASE COST (CAD)',
				'EXT. COST DELTA ($CAD)'
			],
			labels: ['Design', 'Last', 'Delta ($)']
		},
		{
			title: 'Cost/UoM ($CAD)',
			columns: [
				'DESIGN COST PER UNIT (CAD)',
				'PURCHASE COST PER UNIT (CAD)',
				'UNIT COST DELTA ($CAD)',
				'COST UOM'
			],
			labels: ['Design', 'Last', 'Delta ($)', 'UoM']
		}
	];
	const addedGroups = new Set();
	for (const sourceCell of sourceCells) {
		const columnName = sourceCell.dataset.omnifyBomFieldCheckColumn ||
			sourceCell.dataset.omnifyBomFieldCheckAttribute;
		const group = groupDefinitions.find((definition) =>
			definition.columns.includes(columnName)
		);
		if (group) {
			if (addedGroups.has(group.title)) continue;
			const groupCell = createBomCostsHeaderCell(sourceCell, group.title);
			groupCell.colSpan = group.columns.length;
			if (group.title === 'Lead Times (Weeks)') groupCell.style.whiteSpace = 'nowrap';
			topRow.appendChild(groupCell);
			for (let index = 0; index < group.columns.length; index++) {
				const subHeaderSource = sourceCells.find((cell) =>
					(cell.dataset.omnifyBomFieldCheckColumn ||
						cell.dataset.omnifyBomFieldCheckAttribute) === group.columns[index]
				);
				if (!subHeaderSource) {
					throw new Error(`The Proposed BOM "${group.title}" columns are missing.`);
				}
				subRow.appendChild(createBomCostsHeaderCell(subHeaderSource, group.labels[index]));
			}
			addedGroups.add(group.title);
			continue;
		}

		const headerText = sourceCell.dataset.omnifyBomFieldCheckAttribute === 'UNIT OF MEASURE'
			? 'UoM'
			: sourceCell.dataset.omnifyBomFieldCheckAttribute === 'ITEM-WEIGHT(KG)'
				? 'Weight (kg)'
				: sourceCell.textContent;
		const headerCell = createBomCostsHeaderCell(sourceCell, headerText);
		headerCell.rowSpan = 2;
		topRow.appendChild(headerCell);
	}

	if (addedGroups.size !== groupDefinitions.length) {
		throw new Error('Could not build all Proposed BOM grouped columns.');
	}
	headerRow.parentElement.insertBefore(topRow, headerRow);
	headerRow.parentElement.insertBefore(subRow, headerRow);
	headerRow.style.display = 'none';
	table.dataset.omnifyBomFieldCheckGroupedHeaders = 'true';
}

function updateBomFieldCheckTotalsRow(table) {
	const headerRow = getTableHeaderRow(table);
	if (!headerRow?.parentElement) return;

	const allRows = Array.from(table.rows);
	const headerIndex = allRows.indexOf(headerRow);
	const dataRows = allRows.slice(headerIndex + 1).filter((row) =>
		!row.dataset.omnifyBomFieldCheckGroupHeader &&
		!row.dataset.omnifyBomFieldCheckTotalRow &&
		row.cells.length === headerRow.cells.length
	);
	if (!dataRows.length) return;

	let totalRow = table.querySelector('[data-omnify-bom-field-check-total-row]');
	if (!totalRow) {
		totalRow = document.createElement('tr');
		totalRow.dataset.omnifyBomFieldCheckTotalRow = 'true';
		for (const sourceCell of dataRows[0].cells) {
			const cell = sourceCell.cloneNode(false);
			cell.removeAttribute('id');
			cell.textContent = '';
			cell.style.fontWeight = 'bold';
			cell.style.backgroundColor = '#e2f0d9';
			totalRow.appendChild(cell);
		}
		headerRow.after(totalRow);
	}
	const totalCells = Array.from(totalRow.cells);
	for (const cell of totalCells) {
		if (cell.textContent) cell.textContent = '';
		cell.style.color = '';
	}
	const includedRows = dataRows.filter((row) =>
		row.querySelector('[data-omnify-bom-field-check-include]')?.checked !== false
	);

	const getColumnIndex = (key) => Array.from(headerRow.cells).findIndex((cell) =>
		cell.dataset.omnifyBomFieldCheckAttribute === key ||
		cell.dataset.omnifyBomFieldCheckColumn === key ||
		normalizeBomColumnName(cell.textContent) === normalizeBomColumnName(key)
	);
	const partNumberIndex = getColumnIndex('PART NUMBER');
	if (partNumberIndex >= 0) totalCells[partNumberIndex].textContent = 'Total(s):';

	for (const columnName of ['DESIGN LEAD TIME (WEEKS)', 'PURCHASE LEAD TIME (WEEKS)']) {
		const columnIndex = getColumnIndex(columnName);
		if (columnIndex < 0) continue;

		let maximum = null;
		for (const row of includedRows) {
			const value = parseLeadTimeValue(row.cells[columnIndex].textContent);
			if (value !== null && (maximum === null || value > maximum)) maximum = value;
		}
		if (maximum !== null) {
			totalCells[columnIndex].textContent = `Max: ${formatLeadTime(String(maximum))}`;
			totalCells[columnIndex].style.whiteSpace = 'nowrap';
		}
	}

	for (const columnName of ['EXT. DESIGN COST (CAD)', 'EXT. PURCHASE COST (CAD)', 'EXT. COST DELTA ($CAD)']) {
		const columnIndex = getColumnIndex(columnName);
		if (columnIndex < 0) continue;

		let total = 0;
		let hasValue = false;
		for (const row of includedRows) {
			const value = parseCurrencyValue(row.cells[columnIndex].textContent);
			if (value === null) continue;
			total += value;
			hasValue = true;
		}
		if (!hasValue) continue;
		if (columnName === 'EXT. COST DELTA ($CAD)') {
			setBomCostsDeltaValue(totalCells[columnIndex], total);
		} else {
			totalCells[columnIndex].textContent = formatCurrency(String(total));
		}
	}

	const weightIndex = getColumnIndex('ITEM-WEIGHT(KG)');
	const quantityIndex = getColumnIndex('QTY');
	if (weightIndex >= 0 && quantityIndex >= 0) {
		let totalWeight = 0;
		let hasWeight = false;
		for (const row of includedRows) {
			const weight = parseCurrencyValue(row.cells[weightIndex].textContent);
			const quantity = parseCurrencyValue(row.cells[quantityIndex].textContent);
			if (weight === null || quantity === null) continue;
			totalWeight += weight * quantity;
			hasWeight = true;
		}
		if (hasWeight) {
			totalCells[weightIndex].textContent = `${totalWeight.toLocaleString('en-CA', {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2
			})} kg`;
		}
	}

	if (!totalRow.isConnected) headerRow.after(totalRow);
}

function addBomFieldCheckContributorControl(table) {
	if (!table?.parentElement) return;

	let checkbox = document.querySelector('#bom-field-check-contributor-highlight');
	if (!checkbox) {
		const checkboxLabel = document.createElement('label');
		checkboxLabel.style.display = 'inline-flex';
		checkboxLabel.style.alignItems = 'center';
		checkboxLabel.style.gap = '6px';
		checkboxLabel.style.margin = '4px 8px 4px 0';
		checkbox = document.createElement('input');
		checkbox.type = 'checkbox';
		checkbox.id = 'bom-field-check-contributor-highlight';
		checkbox.addEventListener('change', () =>
			updateBomFieldCheckContributorHighlight(
				document.querySelector(SELECTORS.bomFieldCheckTable)
			)
		);
		checkboxLabel.append(checkbox, document.createTextNode('Check Cost/Lead Time Contributors'));
		table.parentElement.insertBefore(checkboxLabel, table);
	}

	if (document.querySelector('#bom-field-check-contributor-scaling')) return;
	const scalingLabel = document.createElement('label');
	scalingLabel.style.display = 'inline-flex';
	scalingLabel.style.alignItems = 'center';
	scalingLabel.style.gap = '4px';
	scalingLabel.style.margin = '4px 0';
	scalingLabel.appendChild(document.createTextNode('Scale: '));
	const scalingSelect = document.createElement('select');
	scalingSelect.id = 'bom-field-check-contributor-scaling';
	for (const [value, text] of [['log', 'Logarithmic'], ['linear', 'Linear']]) {
		const option = document.createElement('option');
		option.value = value;
		option.textContent = text;
		scalingSelect.appendChild(option);
	}
	scalingSelect.value = 'linear';
	scalingSelect.addEventListener('change', () =>
		updateBomFieldCheckContributorHighlight(
			document.querySelector(SELECTORS.bomFieldCheckTable)
		)
	);
	scalingLabel.appendChild(scalingSelect);
	const checkboxLabel = checkbox.closest('label');
	if (checkboxLabel) checkboxLabel.after(scalingLabel);
	else table.parentElement.insertBefore(scalingLabel, table);
}

function updateBomFieldCheckContributorHighlight(table) {
	if (!table) return;
	const headerRow = getTableHeaderRow(table);
	if (!headerRow) return;
	clearBomFieldCheckCellHighlights(table);

	const valueGroups = [
		['EXT. DESIGN COST (CAD)', 'EXT. PURCHASE COST (CAD)'],
		['DESIGN LEAD TIME (WEEKS)', 'PURCHASE LEAD TIME (WEEKS)']
	];
	const columnIndexesByGroup = valueGroups.map((group) => group.map((columnName) =>
		Array.from(headerRow.cells).findIndex((cell) =>
			cell.dataset.omnifyBomFieldCheckColumn === columnName ||
			cell.dataset.omnifyBomFieldCheckAttribute === columnName
		)
	));
	const cellsByGroup = valueGroups.map(() => []);
	const maxima = valueGroups.map(() => 0);
	for (const row of table.rows) {
		if (row === headerRow || row.dataset.omnifyBomFieldCheckGroupHeader ||
			row.dataset.omnifyBomFieldCheckTotalRow) continue;

		for (let groupIndex = 0; groupIndex < columnIndexesByGroup.length; groupIndex++) {
			for (const columnIndex of columnIndexesByGroup[groupIndex]) {
				if (columnIndex < 0) continue;
				const cell = row.cells[columnIndex];
				if (!cell) continue;
				const value = parseCurrencyValue(cell.textContent);
				const amount = value === null ? null : Math.max(0, value);
				cellsByGroup[groupIndex].push({ cell, amount });
				if (amount !== null) maxima[groupIndex] = Math.max(maxima[groupIndex], amount);
			}
		}
	}

	const checkbox = document.querySelector('#bom-field-check-contributor-highlight');
	const enabled = Boolean(checkbox?.checked);
	const scaling = document.querySelector('#bom-field-check-contributor-scaling')?.value;
	for (let groupIndex = 0; groupIndex < cellsByGroup.length; groupIndex++) {
		for (const { cell, amount } of cellsByGroup[groupIndex]) {
			if (!cell.hasAttribute('data-bom-field-check-contributor-original-background')) {
				cell.dataset.bomFieldCheckContributorOriginalBackground = cell.style.backgroundColor;
				cell.dataset.bomFieldCheckContributorOriginalColor = cell.style.color;
			}
			if (!enabled || amount === null) {
				cell.style.backgroundColor = cell.dataset.bomFieldCheckContributorOriginalBackground;
				cell.style.color = cell.dataset.bomFieldCheckContributorOriginalColor;
				cell.removeAttribute('data-bom-field-check-contributor-original-background');
				cell.removeAttribute('data-bom-field-check-contributor-original-color');
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
	updateBomFieldCheckIncludedCellHighlight(table);
}

function updateBomFieldCheckIncludedCellHighlight(table) {
	const headerRow = getTableHeaderRow(table);
	if (!headerRow) return;

	const columns = [
		{ name: 'DESIGN LEAD TIME (WEEKS)', isLeadTime: true, includeGreen: true },
		{ name: 'PURCHASE LEAD TIME (WEEKS)', isLeadTime: true, includeGreen: true },
		{ name: 'EXT. DESIGN COST (CAD)', isLeadTime: false, includeGreen: true },
		{ name: 'EXT. PURCHASE COST (CAD)', isLeadTime: false, includeGreen: true },
		{ name: 'DESIGN COST PER UNIT (CAD)', isLeadTime: false, includeGreen: false },
		{ name: 'PURCHASE COST PER UNIT (CAD)', isLeadTime: false, includeGreen: false }
	];
	const columnIndexes = columns.map((column) =>
		Array.from(headerRow.cells).findIndex((cell) =>
			cell.dataset.omnifyBomFieldCheckColumn === column.name ||
			cell.dataset.omnifyBomFieldCheckAttribute === column.name
		)
	);
	const quantityIndex = Array.from(headerRow.cells).findIndex((cell) =>
		cell.dataset.omnifyBomFieldCheckColumn === 'QTY' ||
		normalizeBomColumnName(cell.textContent) === 'QTY'
	);
	const includedRows = Array.from(table.rows).filter((row) =>
		row !== headerRow &&
		!row.dataset.omnifyBomFieldCheckGroupHeader &&
		!row.dataset.omnifyBomFieldCheckTotalRow &&
		row.querySelector('[data-omnify-bom-field-check-include]')?.checked !== false
	);
	const leadTimeMaxima = columns.map((column, columnIndex) => {
		if (!column.isLeadTime || columnIndexes[columnIndex] < 0) return null;
		let maximum = null;
		for (const row of includedRows) {
			const value = parseLeadTimeValue(row.cells[columnIndexes[columnIndex]]?.textContent);
			if (value !== null && (maximum === null || value > maximum)) maximum = value;
		}
		return maximum;
	});
	const contributorHighlightEnabled = Boolean(
		document.querySelector('#bom-field-check-contributor-highlight')?.checked
	);
	const applyHighlight = (cell, color) => {
		if (!cell.hasAttribute('data-omnify-bom-field-check-highlight-original-background')) {
			cell.dataset.omnifyBomFieldCheckHighlightOriginalBackground = cell.style.backgroundColor;
			cell.dataset.omnifyBomFieldCheckHighlightOriginalColor = cell.style.color;
		}
		cell.style.backgroundColor = color;
		cell.style.color = getBomCostContributorTextColorFromHex(color);
	};
	const totalRow = table.querySelector('[data-omnify-bom-field-check-total-row]');
	for (let columnPosition = 0; columnPosition < columns.length; columnPosition++) {
		if (!columns[columnPosition].isLeadTime) continue;
		const columnIndex = columnIndexes[columnPosition];
		const cell = columnIndex >= 0 ? totalRow?.cells[columnIndex] : null;
		const value = cell?.textContent.trim().replace(/^MAX:\s*/i, '');
		if (cell && parseLeadTimeValue(value) !== null) applyHighlight(cell, '#f4cccc');
	}

	for (const row of table.rows) {
		if (row === headerRow || row.dataset.omnifyBomFieldCheckGroupHeader ||
			row.dataset.omnifyBomFieldCheckTotalRow) continue;

		const includeRow = row.querySelector('[data-omnify-bom-field-check-include]')?.checked !== false;
		for (let columnPosition = 0; columnPosition < columnIndexes.length; columnPosition++) {
			const columnIndex = columnIndexes[columnPosition];
			if (columnIndex < 0) continue;
			const cell = row.cells[columnIndex];
			if (!cell) continue;
			const column = columns[columnPosition];
			const quantity = quantityIndex >= 0
				? parseCurrencyValue(row.cells[quantityIndex]?.textContent)
				: null;
			const leadTimeValue = column.isLeadTime
				? parseLeadTimeValue(cell.textContent)
				: null;
			const isMaximum = includeRow &&
				leadTimeMaxima[columnPosition] !== null &&
				leadTimeValue === leadTimeMaxima[columnPosition];
			const costValue = column.isLeadTime ? null : parseCurrencyValue(cell.textContent);
			const isZero = column.isLeadTime
				? leadTimeValue === 0
				: quantity !== null && quantity > 0 && costValue === 0;
			const highlightColor = isZero
				? '#fff2cc'
				: isMaximum
					? '#f4cccc'
					: column.includeGreen && includeRow && !contributorHighlightEnabled
						? '#e2f0d9'
						: null;
			if (highlightColor) applyHighlight(cell, highlightColor);
		}
	}
}

function clearBomFieldCheckCellHighlights(table) {
	for (const cell of table.querySelectorAll(
		'[data-omnify-bom-field-check-highlight-original-background]'
	)) {
		cell.style.backgroundColor = cell.dataset.omnifyBomFieldCheckHighlightOriginalBackground;
		cell.style.color = cell.dataset.omnifyBomFieldCheckHighlightOriginalColor;
		cell.removeAttribute('data-omnify-bom-field-check-highlight-original-background');
		cell.removeAttribute('data-omnify-bom-field-check-highlight-original-color');
	}
}

function failBomFieldCheckCostRollup(error) {
	console.error('BOM Field Check Cost Rollup failed:', error);
	try {
		sessionStorage.removeItem(getBomFieldCheckWorkflowKey());
	} catch (storageError) {
		console.error('Could not clear the BOM Field Check Cost Rollup state:', storageError);
	}
	setBomFieldCheckButtonState('Cost Rollup (error)', false);
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
	return createViewModeButton(id, label, isActive, () => {
		toggleViewModeButtons(
			'omnify-standard-view',
			'omnify-drawing-view',
			id === 'omnify-drawing-view',
			(isDrawingView) => updateDrawingViewColumns(
				document.querySelector(SELECTORS.itemBomTable),
				isDrawingView
			)
		);
	});
}

function createViewModeButton(id, label, isActive, onClick) {
	const button = document.createElement('button');
	button.id = id;
	button.type = 'button';
	button.textContent = label;
	button.style.marginLeft = '6px';
	button.addEventListener('click', onClick);
	setDrawingViewButtonState(button, isActive);
	return button;
}

function toggleViewModeButtons(standardButtonId, drawingButtonId, isDrawingView, updateColumns) {
	const standardButton = document.getElementById(standardButtonId);
	const drawingButton = document.getElementById(drawingButtonId);
	if (!standardButton || !drawingButton) return;
	setDrawingViewButtonState(standardButton, !isDrawingView);
	setDrawingViewButtonState(drawingButton, isDrawingView);
	updateColumns(isDrawingView);
}

function setDrawingViewButtonState(button, isActive) {
	button.setAttribute('aria-pressed', String(isActive));
	button.style.backgroundColor = isActive ? '#1f4e79' : '';
	button.style.color = isActive ? '#fff' : '';
	button.style.borderColor = isActive ? '#163a5a' : '';
	button.style.boxShadow = isActive ? 'inset 0 2px 4px rgba(0, 0, 0, 0.35)' : '';
	button.style.fontWeight = isActive ? '600' : '';
}

function addEcoDrawingViewControl() {
	const goSummaryCell = document.getElementById(
		'CPMainPage_frmBOMChanges_td_Redlines_BOM_GoSummary'
	);
	if (!goSummaryCell) return;

	let controlsCell = document.getElementById('omnify-eco-view-controls');
	if (!controlsCell) {
		controlsCell = document.createElement('td');
		controlsCell.id = 'omnify-eco-view-controls';
		controlsCell.append(
			createEcoDrawingViewModeButton('omnify-eco-standard-view', 'Standard View', true),
			createEcoDrawingViewModeButton('omnify-eco-drawing-view', 'Drawing View', false)
		);
		goSummaryCell.insertAdjacentElement('afterend', controlsCell);
	}

	const standardButton = document.getElementById('omnify-eco-standard-view');
	const drawingButton = document.getElementById('omnify-eco-drawing-view');
	if (!standardButton || !drawingButton) return;
	const isDrawingView = drawingButton.getAttribute('aria-pressed') === 'true';
	setDrawingViewButtonState(standardButton, !isDrawingView);
	setDrawingViewButtonState(drawingButton, isDrawingView);
	updateEcoDrawingViewColumns(isDrawingView);
}

function createEcoDrawingViewModeButton(id, label, isActive) {
	return createViewModeButton(id, label, isActive, () => {
		toggleViewModeButtons(
			'omnify-eco-standard-view',
			'omnify-eco-drawing-view',
			id === 'omnify-eco-drawing-view',
			updateEcoDrawingViewColumns
		);
	});
}

function updateEcoDrawingViewColumns(isActive) {
	const tables = [
		document.querySelector(SELECTORS.ecoAllBomChangesTable),
		document.querySelector(SELECTORS.ecoItemBomChangesTable)
	].filter(Boolean);

	for (const table of tables) {
		restoreDrawingViewCellOrder(table);
		rememberDrawingViewCellOrder(table);

		let changeColumnIndex = findTableColumnIndex(table, 'Change');
		if (changeColumnIndex < 0) continue;
		if (isActive) {
			reorderEcoDrawingViewColumns(table, changeColumnIndex);
			changeColumnIndex = findTableColumnIndex(table, 'Change');
		}

		const visibleColumnIndexes = new Set();
		for (let columnIndex = 0; columnIndex <= changeColumnIndex; columnIndex++) {
			visibleColumnIndexes.add(columnIndex);
		}
		if (isActive) {
			for (const columnName of ECO_DRAWING_VIEW_COLUMN_ORDER) {
				const columnIndex = findTableColumnIndex(table, columnName);
				if (columnIndex >= 0) visibleColumnIndexes.add(columnIndex);
			}
		}
		const vendorColumnIndex = findTableColumnIndex(table, 'Vendors');

		for (const row of table.rows) {
			if (row.dataset.omnifyBomRevisionGroupHeader) continue;
			for (let columnIndex = 0; columnIndex < row.cells.length; columnIndex++) {
				const cell = row.cells[columnIndex];
				if (!cell.hasAttribute('data-omnify-eco-view-original-display')) {
					cell.setAttribute('data-omnify-eco-view-original-display', cell.style.display);
				}
				const shouldHide = isActive
					? !visibleColumnIndexes.has(columnIndex)
					: vendorColumnIndex >= 0 && columnIndex === vendorColumnIndex;
				cell.style.display = shouldHide
					? 'none'
					: cell.getAttribute('data-omnify-eco-view-original-display');
			}
		}
	}
}

function reorderEcoDrawingViewColumns(table, changeColumnIndex) {
	let anchorColumnIndex = changeColumnIndex;
	for (const columnName of ECO_DRAWING_VIEW_COLUMN_ORDER) {
		if (findTableColumnIndex(table, columnName) < 0) continue;
		moveTableColumnAfterIndex(table, columnName, anchorColumnIndex);
		anchorColumnIndex = findTableColumnIndex(table, columnName);
	}
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
			const isEditControlColumn = columnIndex >= 0 && columnIndex === editColumnIndex;
			const shouldHide = !isEditControlColumn &&
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
	for (const columnName of columnNames) {
		if (findTableColumnIndex(table, columnName) < 0) continue;
		moveTableColumnAfterIndex(table, columnName, anchorColumnIndex);
		anchorColumnIndex = findTableColumnIndex(table, columnName);
	}
}

function moveTableColumnAfterIndex(table, columnName, targetColumnIndex) {
	const columnIndex = findTableColumnIndex(table, columnName);
	if (columnIndex < 0 || targetColumnIndex < -1 ||
		columnIndex === targetColumnIndex || columnIndex === targetColumnIndex + 1) return;

	for (const row of table.rows) {
		if (row.dataset.omnifyBomRevisionGroupHeader) continue;
		const cell = row.cells[columnIndex];
		if (!cell) continue;
		if (targetColumnIndex === -1) {
			row.insertBefore(cell, row.cells[0] || null);
			continue;
		}
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
	return -1;
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
	clearBomCostsStatusHighlight(table);

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
	highlightBomCostsStatusValues(table);
}

function clearBomCostsStatusHighlight(table) {
	for (const cell of table.querySelectorAll('[data-bom-cost-status-original-background]')) {
		cell.style.backgroundColor = cell.dataset.bomCostStatusOriginalBackground;
		cell.style.color = cell.dataset.bomCostStatusOriginalColor;
		cell.removeAttribute('data-bom-cost-status-original-background');
		cell.removeAttribute('data-bom-cost-status-original-color');
	}
}

function highlightBomCostsStatusValues(table) {
	const leadTimeColumns = [
		'DESIGN LEAD TIME (WEEKS)',
		'PURCHASE LEAD TIME (WEEKS)'
	];
	const costColumns = [
		'EXT. DESIGN COST (CAD)',
		'EXT. PURCHASE COST (CAD)',
		'DESIGN COST PER UNIT (CAD)',
		'PURCHASE COST PER UNIT (CAD)'
	];
	const headerRow = getTableHeaderRow(table);
	const totalRow = Array.from(table.rows).find((row) =>
		Array.from(row.cells).some((cell) =>
			cell.textContent.trim().replace(/\s+/g, ' ').toUpperCase() === 'TOTAL(S):'
		)
	);
	if (!headerRow) return;

	const dataRows = Array.from(table.rows).filter((row) =>
		row !== headerRow && row !== totalRow && !row.dataset.bomCostGroupHeader
	);
	const leadTimeMaxima = new Map();
	for (const columnName of leadTimeColumns) {
		let maximum = null;
		for (const row of dataRows) {
			const value = parseLeadTimeValue(getBomCostsCell(table, row, columnName)?.textContent);
			if (value !== null && (maximum === null || value > maximum)) maximum = value;
		}
		leadTimeMaxima.set(columnName, maximum);
	}

	for (const row of dataRows) {
		const quantity = parseCurrencyValue(getBomCostsCell(table, row, 'Qty')?.textContent);
		for (const columnName of leadTimeColumns) {
			const cell = getBomCostsCell(table, row, columnName);
			const value = parseLeadTimeValue(cell?.textContent);
			if (!cell || value === null) continue;

			const color = value === 0
				? '#fff2cc'
				: value === leadTimeMaxima.get(columnName) ? '#f4cccc' : '';
			if (color) setBomCostsStatusHighlight(cell, color);
		}
		if (quantity === null || quantity <= 0) continue;

		for (const columnName of costColumns) {
			const cell = getBomCostsCell(table, row, columnName);
			if (!cell || parseCurrencyValue(cell.textContent) !== 0) continue;
			setBomCostsStatusHighlight(cell, '#fff2cc');
		}
	}
	for (const columnName of leadTimeColumns) {
		const cell = totalRow ? getBomCostsCell(table, totalRow, columnName) : null;
		const value = cell?.textContent.trim().replace(/^MAX:\s*/i, '');
		if (cell && parseLeadTimeValue(value) !== null) {
			setBomCostsStatusHighlight(cell, '#f4cccc');
		}
	}
}

function setBomCostsStatusHighlight(cell, color) {
	cell.dataset.bomCostStatusOriginalBackground = cell.style.backgroundColor;
	cell.dataset.bomCostStatusOriginalColor = cell.style.color;
	cell.style.backgroundColor = color;
	cell.style.color = getBomCostContributorTextColorFromHex(color);
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

function getBomCostContributorTextColorFromHex(background) {
	const channels = background.slice(1).match(/.{2}/g).map((channel) =>
		parseInt(channel, 16)
	);
	return getBomCostContributorTextColor(channels);
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
	updateBomCostsUnitDelta(table, hasCostUom, headerRow, totalsRow);
	updateBomCostsUomColumn(table, hasCostUom, headerRow, totalsRow);
	updateBomCostsDelta(table, groups.length === costGroups.length, headerRow, totalsRow);

	const formattedColumns = groups.flatMap((group) => [group.lead, group.unit, group.extended]);
	if (findTableColumnIndex(table, BOM_LEAD_TIME_DELTA_COLUMN) >= 0) {
		formattedColumns.push(BOM_LEAD_TIME_DELTA_COLUMN);
	}
	if (hasCostUom) formattedColumns.push(BOM_COST_UNIT_DELTA_COLUMN);
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
		const unitDeltaCell = getBomCostsCell(table, row, BOM_COST_UNIT_DELTA_COLUMN);
		const purchaseCell = getBomCostsCell(table, row, 'PURCHASE COST PER UNIT (CAD)');
		const anchorCell = unitDeltaCell || purchaseCell;
		if (anchorCell && costUomCell !== anchorCell.nextElementSibling) {
			anchorCell.after(costUomCell);
		}
		if (purchaseCell) {
			setBomCostsCellDefaultBackground(table, row, costUomCell);
		}
	}
}

function updateBomCostsUnitDelta(table, includeUnitDelta, headerRow, totalsRow) {
	const existingDeltaIndex = findTableColumnIndex(table, BOM_COST_UNIT_DELTA_COLUMN);
	if (!includeUnitDelta) {
		if (existingDeltaIndex >= 0) {
			for (const row of table.rows) {
				if (!row.dataset.bomCostGroupHeader) {
					getBomCostsCell(table, row, BOM_COST_UNIT_DELTA_COLUMN)?.remove();
				}
			}
		}
		return;
	}

	if (findTableColumnIndex(table, 'DESIGN COST PER UNIT (CAD)') < 0 ||
		findTableColumnIndex(table, 'PURCHASE COST PER UNIT (CAD)') < 0) return;

	for (const row of table.rows) {
		if (row.dataset.bomCostGroupHeader) continue;
		let deltaCell = getBomCostsCell(table, row, BOM_COST_UNIT_DELTA_COLUMN);
		const purchaseCell = getBomCostsCell(table, row, 'PURCHASE COST PER UNIT (CAD)');
		if (!deltaCell) {
			if (!purchaseCell) continue;
			deltaCell = purchaseCell.cloneNode(false);
			deltaCell.removeAttribute('id');
			deltaCell.style.width = '';
			deltaCell.dataset.bomCostColumnKey = normalizeBomColumnName(BOM_COST_UNIT_DELTA_COLUMN);
			deltaCell.textContent = row === headerRow ? BOM_COST_UNIT_DELTA_COLUMN : '';
		}

		if (purchaseCell && deltaCell !== purchaseCell.nextElementSibling) {
			purchaseCell.after(deltaCell);
		}
		setBomCostsCellDefaultBackground(table, row, deltaCell);
		if (row === headerRow || row === totalsRow) {
			if (row === totalsRow && deltaCell.textContent) deltaCell.textContent = '';
			continue;
		}

		const designValue = parseCurrencyValue(
			getBomCostsCell(table, row, 'DESIGN COST PER UNIT (CAD)')?.textContent
		);
		const purchaseValue = parseCurrencyValue(purchaseCell?.textContent);
		if (designValue === null || purchaseValue === null) {
			deltaCell.textContent = '';
			deltaCell.style.color = '';
			continue;
		}
		setBomCostsDeltaValue(deltaCell, purchaseValue - designValue);
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
	});
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
		BOM_COST_UNIT_DELTA_COLUMN,
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
		{ name: 'Design', lead: 'DESIGN LEAD TIME (WEEKS)', unit: 'DESIGN COST PER UNIT (CAD)', extended: 'EXT. DESIGN COST (CAD)' },
		{ name: 'Last', lead: 'PURCHASE LEAD TIME (WEEKS)', unit: 'PURCHASE COST PER UNIT (CAD)', extended: 'EXT. PURCHASE COST (CAD)' }
	].filter((group) =>
		findTableColumnIndex(table, group.lead) >= 0 &&
		findTableColumnIndex(table, group.unit) >= 0 &&
		findTableColumnIndex(table, group.extended) >= 0
	);
	const hasDelta = findTableColumnIndex(table, BOM_COST_DELTA_COLUMN) >= 0;
	const hasUnitDelta = findTableColumnIndex(table, BOM_COST_UNIT_DELTA_COLUMN) >= 0;
	const hasCostUom = findTableColumnIndex(table, BOM_COST_UOM_COLUMN) >= 0;
	const hasLeadTimeDelta = findTableColumnIndex(table, BOM_LEAD_TIME_DELTA_COLUMN) >= 0;
	const signature = `${groupDefinitions.map((group) => group.name).join('|')}|leadDelta:${hasLeadTimeDelta}|delta:${hasDelta}|unitDelta:${hasUnitDelta}|uom:${hasCostUom}`;
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
				...groupDefinitions.map((group) => ({ name: group.name, field: group.lead })),
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
				...(hasUnitDelta ? [{ name: 'Delta ($)', field: BOM_COST_UNIT_DELTA_COLUMN }] : []),
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

function addQuickSearchButtons() {
	const commonSearchBox = document.querySelector('table.CommonSearchBox');
	const searchBoxRow = commonSearchBox?.rows[0];
	if (!searchBoxRow ||
		document.getElementById('omnifyTitleTabsQuickSearchButtons')) return;

	const controlsCell = document.createElement('td');
	const controlsTable = document.createElement('table');
	controlsTable.style.borderCollapse = 'separate';
	controlsTable.style.borderSpacing = '4px 0';
	controlsTable.style.width = 'auto';
	const controlsRow = controlsTable.insertRow();
	const controlsContentCell = controlsRow.insertCell();
	controlsContentCell.style.padding = '0';
	const controls = document.createElement('div');
	controls.id = 'omnifyTitleTabsQuickSearchButtons';
	controls.setAttribute('role', 'group');
	controls.setAttribute('aria-label', 'Search by database');
	Object.assign(controls.style, {
		display: 'flex',
		flexWrap: 'nowrap',
		gap: '4px',
		width: 'max-content'
	});

	for (const target of QUICK_SEARCH_TARGETS) {
		const button = document.createElement('button');
		button.type = 'button';
		button.textContent = target.label;
		Object.assign(button.style, {
			background: '#f5f8fc',
			border: '1px solid #b7c9dc',
			borderRadius: '3px',
			color: '#174a73',
			cursor: 'pointer',
			font: '12px Arial, sans-serif',
			padding: '4px 6px',
			whiteSpace: 'nowrap'
		});
		button.setAttribute(
			'onclick',
			`javascript:LaunchTopSearch('/Empower/Apps/Desktop/Search/QuickFind.aspx?obj=${target.objectType}', 'ObjectHeaderWidget_frmSearchWidget_tbxTopSearchTerm', '_blank')`
		);
		controls.appendChild(button);
	}

	controlsContentCell.appendChild(controls);
	controlsCell.appendChild(controlsTable);
	searchBoxRow.appendChild(controlsCell);
}

function startTitleUpdates() {
	clearBomFieldCheckWorkflowsOutsideReport();
	updateTitle();
	updateBomTableColumns();
	addQuickSearchButtons();
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
					addQuickSearchButtons();
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
	if (globalThis.__omnifyTitleTabsPostbackHandlerRegistered) return;

	window.addEventListener('omnify-title-tabs-postback-end', () => {
		updateTitle();
		updateBomTableColumns();
		try {
			const workflow = loadBomFieldCheckWorkflow();
			if (workflow?.active && (workflow.awaitingPageLoad || workflow.waitingForPostback)) {
				finishBomFieldCheckPostback(workflow);
			}
		} catch (error) {
			failBomFieldCheckCostRollup(error);
		}
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
