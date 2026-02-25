import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { impedimentsDownloadPath, setDownloadPath } from './utils/downloadPath.js';

const IMPEDIMENTS_URL = 'https://calculadoras.trabajo.gob.ec/impedimento';

const waitForDownload = async (dir, timeout = 120_000) => {
    const start = Date.now();
    let lastSize = 0;
    let stableCount = 0;

    while (Date.now() - start < timeout) {
        const files = fs.readdirSync(dir)
            .filter(f => !f.endsWith('.crdownload'));

        if (files.length) {
            const filePath = path.join(dir, files[0]);
            const { size } = fs.statSync(filePath);

            if (size === lastSize) {
                stableCount++;
            } else {
                stableCount = 0;
                lastSize = size;
            }

            // tamaño estable por ~1s (3 x 300ms)
            if (stableCount >= 3) {
                return files[0];
            }
        }

        await new Promise(r => setTimeout(r, 300));
    }

    throw new Error('Timeout descarga (archivo no finalizó)');
};

export const normalizeBirthDate = (dateStr) => {
    if (!dateStr) return null;

    const parts = dateStr.split('/');
    if (parts.length !== 3) return dateStr;

    let [month, day, year] = parts.map(p => p.trim());

    const mm = month.padStart(2, '0');
    const dd = day.padStart(2, '0');

    let yyyy = year;
    if (year.length === 2) {
        const yy = Number(year);
        yyyy = yy >= 30 ? `19${year}` : `20${year}`;
    }

    return `${mm}/${dd}/${yyyy}`;
};

const invertBirthDate = (dateStr) => {
    const [mm, dd, yyyy] = dateStr.split('/');
    return `${dd}/${mm}/${yyyy}`;
};

const toSafeName = (personName) =>
    personName
        .replace(/\s+/g, '_')
        .replace(/[^\w\-]/g, '');

const clearInput = async (page, selector) => {
    await page.evaluate((sel) => {
        const input = document.querySelector(sel);
        if (input) input.value = '';
    }, selector);
};

export const consolidateCertificates = (results) => {
    for (const { name, tempDir } of results) {
        const files = fs.readdirSync(tempDir).filter(f => !f.endsWith('.crdownload'));
        if (!files.length) {
            console.warn(`⚠️ No file found in ${tempDir}, skipping.`);
            continue;
        }

        const safeName = toSafeName(name);
        const finalPath = path.join(impedimentsDownloadPath, `${safeName}.pdf`);

        fs.renameSync(path.join(tempDir, files[0]), finalPath);
        fs.rmdirSync(tempDir);
    }
};

/**
 * Scrape Impediments
 */
export const scrapeImpediment = async ({
    id,
    birthDate,
    browser,
}) => {
    let page;
    let retried = false;

    const idInputSelector = '#txtNumeroDocumento';
    const birthInputSelector = '#txtFechaI';
    const nameSelector = 'label.control-label + .input-group span.form-control';

    const tempDir = path.join(impedimentsDownloadPath, id);

    try {
        page = await browser.newPage();

        // ⏱ Timeouts globales: 2 minutos
        page.setDefaultTimeout(120_000);
        page.setDefaultNavigationTimeout(120_000);

        fs.mkdirSync(tempDir, { recursive: true });

        await setDownloadPath({ page, downloadPath: path.resolve(tempDir) });

        await page.goto(IMPEDIMENTS_URL, { waitUntil: 'networkidle2' });

        await page.type(idInputSelector, id, { delay: 100 });

        await page.locator(
            'xpath=//button[normalize-space(text())="Buscar"]'
        ).click();

        await page.waitForSelector(birthInputSelector, { visible: true });

        const personName = await page.$eval(
            nameSelector,
            el => el.textContent.trim()
        );

        let currentBirthDate = birthDate;

        while (true) {
            await clearInput(page, birthInputSelector);
            await page.type(birthInputSelector, currentBirthDate, { delay: 100 });

            await page.locator(
                'xpath=//button[contains(normalize-space(.), "VERIFICAR IMPEDIMENTO")]'
            ).click();

            const flow = await Promise.race([
                page.waitForSelector(
                    'xpath=//button[contains(normalize-space(.), "GENERAR CERTIFICADO")]',
                    { visible: true }
                ).then(() => 'GENERAR'),

                page.waitForSelector('#swal2-title', { visible: true })
                    .then(() => 'SWEETALERT'),
            ]);

            if (flow === 'GENERAR') {
                await page.locator(
                    'xpath=//button[contains(normalize-space(.), "GENERAR CERTIFICADO")]'
                ).click();

                await page.waitForSelector('#swal2-title', { visible: true });

                const swalTitle = await page.$eval(
                    '#swal2-title',
                    el => el.textContent.trim().toUpperCase()
                );

                if (swalTitle === 'ERROR') {
                    throw new Error(`SweetAlert ERROR para la cédula ${id}`);
                }

                await page.locator('button.swal2-confirm').click();
                break;
            }

            if (flow === 'SWEETALERT') {
                const swalTitle = await page.$eval(
                    '#swal2-title',
                    el => el.textContent.trim().toUpperCase()
                );

                const swalMessage = await page.$eval(
                    '#swal2-html-container',
                    el => el.textContent.trim()
                );

                if (
                    swalTitle === 'ERROR' &&
                    swalMessage.includes('El formato de la fecha es incorrecto') &&
                    !retried
                ) {
                    retried = true;
                    currentBirthDate = invertBirthDate(currentBirthDate);

                    console.warn(
                        `⚠️ Fecha incorrecta para ID ${id}. Reintentando con formato invertido: ${currentBirthDate}`
                    );

                    await page.locator('button.swal2-confirm').click();
                    continue;
                }

                throw new Error(`SweetAlert ERROR para la cédula ${id}: ${swalMessage}`);
            }
        }

        await waitForDownload(tempDir);

        return {
            id,
            name: personName,
            tempDir,
        };

    } catch (error) {
        console.error(`❌ Error scrapeImpediment [${id}]:`, error.message);
        throw error;
    } finally {
        await page?.close();
    }
};

/**
 * Processes a batch of people sequentially using its own browser instance.
 */
export const retrieveImpediments = async ({ people, puppeteerOptions = {} }) => {
    const browser = await puppeteer.launch({ headless: false, ...puppeteerOptions });

    const results = [];
    const errors = [];

    try {
        for (const person of people) {
            try {
                const birthDate = normalizeBirthDate(person.birthDate);

                const result = await scrapeImpediment({
                    browser,
                    id: person.id,
                    birthDate,
                });

                console.log('SUCCESS:', result.name);
                results.push(result);
            } catch (error) {
                errors.push({ person, error });
            }
        }
    } finally {
        await browser.close();
    }

    return { results, errors };
};
