import puppeteer from 'puppeteer';
import { retrieveImpediments, scrapeImpediment } from './retrieveImpediments.js';
import people from "./imp.json" assert { type: "json" };


(async () => {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: false,
        });

        const id = "1720544632";
        const birthDate = "03/08/2000";

        const iaenPeople = people.filter(person => person["ACTIVO/PASIVO/VACANTE "]?.toLowerCase()?.includes("activo"))
        /*await scrapeImpediment({
            id,
            birthDate,
            browser,

        })*/

        const {
            results: data,
        } = await retrieveImpediments({
            browser,
            people: iaenPeople,
        });
        
    } catch (error) {
        console.error(error);
    } finally {
        await browser?.close();
    }
})();