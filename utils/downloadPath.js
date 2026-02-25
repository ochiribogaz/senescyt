import path from "path";

export const senescytDownloadPath = path.resolve('./certificados');
export const impedimentsDownloadPath = path.resolve('./certificados-impedimento');

/**
 * Sets the download path for the Puppeteer page.
 * @param {object} options - The options object.
 * @param {import('puppeteer').Page} options.page - The Puppeteer page object.
 * @param {string} options.downloadPath - The download path to download documents,
 */
export const setDownloadPath = async ({
    page,
    downloadPath = senescytDownloadPath,
}) => {
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath,
    });
}