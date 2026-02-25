import fs from 'fs';
import path from 'path';
import { createInterface } from 'readline/promises';
import cliProgress from 'cli-progress';
import xlsx from 'json-as-xlsx';
import { retrieveImpediments, consolidateCertificates } from './retrieveImpediments.js';
import { calculateBrowserCount } from './utils/browserResources.js';
import { impedimentsDownloadPath } from './utils/downloadPath.js';
import people from './impedimentsCari.json' assert { type: 'json' };

const rl = createInterface({ input: process.stdin, output: process.stdout });

const ask = (question) => rl.question(question).then(a => a.trim().toLowerCase());

const batchPeople = (arr, n) => {
    const size = Math.ceil(arr.length / n);
    return Array.from({ length: n }, (_, i) => arr.slice(i * size, (i + 1) * size))
        .filter(batch => batch.length > 0);
};

const formatDuration = (ms) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
};

const printReport = (elapsedMs, cpuUsage, total, success, errors) => {
    const cpuUserSec   = (cpuUsage.user   / 1_000_000).toFixed(2);
    const cpuSystemSec = (cpuUsage.system / 1_000_000).toFixed(2);
    console.log('\n--- Report ---');
    console.log(`Execution time:  ${formatDuration(elapsedMs)}`);
    console.log(`CPU user time:   ${cpuUserSec}s`);
    console.log(`CPU system time: ${cpuSystemSec}s`);
    console.log(`Processed:       ${total}`);
    console.log(`Success:         ${success}`);
    console.log(`Errors:          ${errors}`);
};

const generateExcel = (allResults, certPaths) => {
    const columns = [
        { label: 'Número de Identificación', value: 'id' },
        { label: 'Apellidos y Nombres',       value: 'name' },
        { label: 'Fecha de Nacimiento',        value: 'birthDate' },
        { label: 'Registra Impedimento',       value: 'hasImpediment' },
    ];

    if (certPaths) {
        columns.push({ label: 'Certificado', value: 'certificado' });
    }

    const content = allResults.map(r => ({
        id:            r.id,
        name:          r.name,
        birthDate:     r.birthDate,
        hasImpediment: r.hasImpediment,
        ...(certPaths && { certificado: certPaths.get(r.id) ?? '' }),
    }));

    const excelPath = path.join(impedimentsDownloadPath, 'impedimentos.xlsx');

    const buffer = xlsx(
        [{ sheet: 'Impedimentos', columns, content }],
        { writeOptions: { type: 'buffer' } }
    );

    fs.mkdirSync(impedimentsDownloadPath, { recursive: true });
    fs.writeFileSync(excelPath, buffer);
    console.log(`Excel guardado: ${excelPath}`);
};

(async () => {
    try {
        const { cpuCount, totalMemoryGB, availableMemoryGB, recommended } =
            calculateBrowserCount(people.length);

        console.log('\n--- System Info ---');
        console.log(`CPUs:              ${cpuCount}`);
        console.log(`Total RAM:         ${totalMemoryGB} GB`);
        console.log(`Available RAM:     ${availableMemoryGB} GB`);
        console.log('-------------------');
        console.log(`People to process:    ${people.length}`);
        console.log(`Recommended browsers: ${recommended}`);

        let browserCount;
        const confirmBrowsers = await ask(`\nUse ${recommended} browser(s)? (y/n): `);

        if (confirmBrowsers === 'y') {
            browserCount = recommended;
        } else {
            const input = await ask('Enter number of browsers: ');
            browserCount = Math.max(1, parseInt(input, 10) || 1);
        }

        const generateExcelFile    = (await ask('\nGenerate Excel file? (y/n): '))    === 'y';
        const downloadCertificates = (await ask('Download certificates? (y/n): ')) === 'y';

        // Runs a set of people through parallel browser batches with a progress bar.
        const runBatches = async (targetPeople, label) => {
            const count   = Math.min(browserCount, targetPeople.length);
            const batches = batchPeople(targetPeople, count);

            console.log(`\n${label} ${targetPeople.length} people with ${count} browser(s)...\n`);

            const multibar = new cliProgress.MultiBar({
                clearOnComplete: false,
                hideCursor: true,
                format: ' Progress |{bar}| {value}/{total} ({percentage}%)',
            }, cliProgress.Presets.shades_grey);

            const bar = multibar.create(targetPeople.length, 0);
            let processed = 0;

            const onProgress = ({ id, name, hasImpediment, success, error }) => {
                processed++;
                bar.update(processed);
                if (success) {
                    multibar.log(`[${processed}/${targetPeople.length}] SUCCESS: ${name} — ${hasImpediment}\n`);
                } else {
                    multibar.log(`[${processed}/${targetPeople.length}] ERROR [${id}] ${name}: ${error.message}\n`);
                }
            };

            const batchResults = await Promise.all(
                batches.map(batch => retrieveImpediments({ people: batch, onProgress, downloadCertificates }))
            );

            multibar.stop();

            return {
                results: batchResults.flatMap(r => r.results),
                errors:  batchResults.flatMap(r => r.errors),
            };
        };

        // --- Initial run ---
        const startTime = Date.now();
        const startCpu  = process.cpuUsage();

        let { results: allResults, errors: allErrors } = await runBatches(people, 'Processing');

        const elapsedMs = Date.now() - startTime;
        const cpuUsage  = process.cpuUsage(startCpu);

        let certPaths = null;
        if (downloadCertificates && allResults.length > 0) {
            console.log(`\nConsolidating ${allResults.length} certificate(s)...`);
            certPaths = consolidateCertificates(allResults);
        }

        if (generateExcelFile) {
            generateExcel(allResults, certPaths);
        }

        printReport(elapsedMs, cpuUsage, people.length, allResults.length, allErrors.length);

        // --- Retry loop ---
        while (allErrors.length > 0) {
            console.log(`\n--- Errors (${allErrors.length}) ---`);
            allErrors.forEach(({ person, error }) =>
                console.error(`  [${person.id}] ${person.name}: ${error.message}`)
            );

            const retry = await ask(`\nRetry ${allErrors.length} failed people? (y/n): `);
            if (retry !== 'y') break;

            const failedPeople = allErrors.map(e => e.person);
            const { results: retryResults, errors: retryErrors } = await runBatches(failedPeople, 'Retrying');

            if (retryResults.length > 0) {
                allResults = [...allResults, ...retryResults];

                if (downloadCertificates) {
                    const newCertPaths = consolidateCertificates(retryResults);
                    certPaths = certPaths
                        ? new Map([...certPaths, ...newCertPaths])
                        : newCertPaths;
                }

                if (generateExcelFile) {
                    generateExcel(allResults, certPaths);
                }
            }

            allErrors = retryErrors;
        }

        console.log('\nDone.');
    } catch (error) {
        console.error(error);
    } finally {
        rl.close();
    }
})();
