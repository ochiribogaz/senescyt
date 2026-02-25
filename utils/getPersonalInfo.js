const PERSONAL_INFO_KEYS = {
    ['Identificación:']: 'id',
    ['Nombres:']: 'names',
    ['Género:']: 'gender',
    ['Nacionalidad:']: 'nationality',
}

export const getPersonalInfo = async ({
    id,
    page,
    personalInfoLabelsSelector = '.ui-outputlabel.ui-widget',
    timeout = 5_000,
}) => {
    const infoBtnSelector = 'button#formPrincipal\\:btnInfoConsulta';

    await page.waitForSelector(infoBtnSelector, { timeout, });

    const { personalInfo, labels } = await page.evaluate((id, personalInfoKeys, personalInfoLabelsSelector) => {
        const personalInfo = {};

        const idXpath = `//label[text()='${id}']`;
        const idLabel = document.evaluate(idXpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

        if (!idLabel) {
            console.error('No personal info found');
            return personalInfo;
        }

        const table = idLabel?.parentElement?.parentElement?.parentElement?.parentElement;

        if (!table) {
            console.error('No table with personal info found');
            return personalInfo;
        }


        const labels = Array.from(table.querySelectorAll(personalInfoLabelsSelector));

        labels.forEach((label, labelIndex) => {
            const labelText = label.textContent.trim();
            console.log(labelText, personalInfo)
            if (labelIndex % 2 !== 0) {
                const key = personalInfoKeys[labels[labelIndex - 1]?.textContent?.trim()];
                if (!key) return;
                personalInfo[key] = labelText;
                return;
            }
            const key = personalInfoKeys[labelText];
            if (!key) return;
            personalInfo[key] = '';
        });

        return { personalInfo, labels };
    }, id, PERSONAL_INFO_KEYS, personalInfoLabelsSelector);

    return personalInfo;
}