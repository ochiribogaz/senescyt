import { PromisePool } from '@supercharge/promise-pool'
import { getPersonalInfo } from "./utils/getPersonalInfo.js";
import { getSenescytCodeFromImg } from "./utils/getSenescytCodeFromImg.js";
import { getTitles } from './utils/getTitles.js';
import { fnWithRetry } from "./utils/fnWithRetry.js";
import { getSenescytError } from './utils/getSenescytError.js';
import { setDownloadPath } from './utils/downloadPath.js';

const SENESCYT_URL = 'https://www.senescyt.gob.ec/consulta-titulos-web/faces/vista/consulta/consulta.xhtml';

const TITLE_COLUMNS = [
    { label: 'Título', value: 'title' },
    { label: 'Nivel', value: 'level' },
    { label: 'Institución de Educación Superior', value: 'institution' },
    { label: 'Tipo', value: 'type' },
    { label: 'Reconocido por', value: 'recognizedBy' },
    { label: 'Número de Registro', value: 'registrationNumber' },
    { label: 'Fecha de Registro', value: 'registrationDate' },
    { label: 'Área o Campo de Conocimiento', value: 'knowledgeField' },
    { label: 'Observación', value: 'observation' },
];

const PERSONAL_INFO_COLUMNS = [
    { label: 'Identificación', value: 'id' },
    { label: 'Nombres', value: 'names' },
    { label: 'Género', value: 'gender' },
    { label: 'Nacionalidad', value: 'nationality' },
];

export const accessSenescytData = async ({
    id,
    browser
}) => {

    const page = await browser.newPage();

    await page.goto(SENESCYT_URL, { waitUntil: 'networkidle2', });

    const idInputSelector = 'input[placeholder="Identificación (Cédula/Pasaporte/D.I. País de origen)"]';
    const idInput = await page.$(idInputSelector);

    const imgSelector = '#formPrincipal\\:capimg';
    const img = await page.waitForSelector(imgSelector);

    const codeImgBuffer = await img.screenshot();
    const code = await getSenescytCodeFromImg({
        codeImgBuffer,
    })

    const codeInputSelector = '#formPrincipal\\:captchaSellerInput';
    await page.waitForSelector(codeInputSelector);

    await idInput.type(id, { delay: 100 });
    await page.type(codeInputSelector, code);

    // console.log(code)

    /* const buttonSelector = '#formPrincipal\\:boton-buscar';
    await page.waitForSelector(buttonSelector);

    // await page.waitForNavigation({ waitUntil: 'domcontentloaded' });
    await page.click(buttonSelector); */

    const resultSelector = 'h4.panel-title';

    await page.waitForSelector(resultSelector, { timeout: 10000 })

    return page;
}

export const scrapeSenescytDataById = async ({
    id,
    browser,
}) => {
    let page;
    try {

        page = await accessSenescytData({
            id,
            browser,
        })

        const personalInfo = await getPersonalInfo({
            id,
            page,
        });

        if (Object.keys(personalInfo)?.length === 0) {
            throw new Error(`No data found for id (${id})`);
        }

        const titles = await getTitles({
            page,
        });

        const titlesSheet = {
            sheet: id,
            columns: TITLE_COLUMNS,
            content: titles,
        };

        return {
            titlesSheet,
            personalInfo,
        }
    } catch (error) {
        console.error(error);
        throw error;
    } finally {
        await page?.close();
    }
}

export const initCertificationDownload = async ({
    page,
}) => {
    const downloadButtonSelector = "#formPrincipal\\:btnInfoConsulta";
    await page.click(downloadButtonSelector);
}


export const downloadSenescytCertificationById = async ({
    id,
    browser,
}) => {
    let page;
    let result = false;
    try {

        page = await accessSenescytData({
            id,
            browser,
        });

        await getSenescytError({ page });

        await setDownloadPath({ page });

        await initCertificationDownload({ page });

        await new Promise(resolve => setTimeout(resolve, 5000));
        result = true;
    } catch (error) {
        //console.error(error);
        throw error;
    } finally {
        await page?.close();
        return result;
    }
}


export const retrieveSenescytData = async ({
    browser,
    strIds,
    separator = ',',
    retries = 2,
}) => {
    try {
        const ids = strIds.split(separator);
        const peopleSheet = {
            sheet: 'Personas',
            columns: PERSONAL_INFO_COLUMNS,
            content: [],
        };

        console.log(ids)
        const { errors, results } = await PromisePool
            .for(ids)
            .withConcurrency(2)
            .process(async (id) => {
                const { titlesSheet, personalInfo, } = await fnWithRetry(scrapeSenescytDataById, retries)({ id, browser });
                peopleSheet.content.push(personalInfo);
                return titlesSheet;
            });
        return {
            errors,
            results,
            peopleSheet,
        };

    } catch (error) {
        console.error(error);
    }
}