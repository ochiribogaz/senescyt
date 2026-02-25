export const TITLE_DATA_KEYS = [
    'title',
    'institution',
    'type',
    'recognizedBy',
    'registrationNumber',
    'registrationDate',
    'knowledgeField',
    'observation',
];

export const TITLE_FOR_4RT_LEVEL = 'Título(s) de cuarto nivel o posgrado';
export const TITLE_FOR_3RD_LEVEL = 'Título(s) de tercer nivel de grado';
export const TITLE_FOR_TECH_3RD_LEVEL = 'Título(s) de tercer nivel técnico-tecnológico superior';

const REQUIRED_TITLES_TYPES = [
    TITLE_FOR_3RD_LEVEL,
    TITLE_FOR_TECH_3RD_LEVEL,
    TITLE_FOR_4RT_LEVEL,
];

export const getTitles = async ({
    page,
    h4TitleSelector = 'h4.panel-title',
    titlesDivSelector = '.panel.panel-primary',
    requiredTitleTypes = REQUIRED_TITLES_TYPES,
}) => {
    const titles = await page.evaluate(({
        h4TitleSelector,
        titlesDivSelector,
        requiredTitleTypes,
        titleDataKeys,
    }) => {
        const titles = [];

        const h4s = Array.from(document.querySelectorAll(h4TitleSelector));
        const allowedH4s = h4s.filter(h4 => requiredTitleTypes.includes(h4.textContent.trim()));

        allowedH4s.forEach(h4 => {
            const titlesDiv = h4.closest(titlesDivSelector);

            if (!titlesDiv) return titles;

            const tableSelector = 'table';
            const table = titlesDiv.querySelector(tableSelector);

            if (!table) return titles;

            const level = h4.textContent.trim();
            
            const rowsSelector = 'tr';
            const rows = table.querySelectorAll(rowsSelector);
            const rowElements = Array.from(rows).slice(1);
            rowElements.forEach(row => {
                const title = {
                    level,
                };
                const cellsSelector = 'td';
                const cells = row.querySelectorAll(cellsSelector);
                const cellElements = Array.from(cells);
                cellElements.forEach((cell, cellIndex) => {
                    const cellText = cell?.innerText?.trim();
                    const titleKey = titleDataKeys[cellIndex];
                    if (!titleKey) return;
                    title[titleKey] = cellText;
                });
                titles.push(title);
            });
        });

        return titles;
    }, {
        h4TitleSelector,
        titlesDivSelector,
        requiredTitleTypes,
        titleDataKeys: TITLE_DATA_KEYS,
    }
    );

    return titles;
}
