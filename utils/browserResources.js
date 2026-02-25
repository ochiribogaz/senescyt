import os from 'os';

// Conservative estimates per Chromium instance
const RAM_PER_BROWSER_GB = 0.75;  // ~750 MB
const CORES_PER_BROWSER = 2;

export const calculateBrowserCount = (peopleCount) => {
    const cpuCount = os.cpus().length;
    const totalMemoryGB = os.totalmem() / (1024 ** 3);
    const freeMemoryGB = os.freemem() / (1024 ** 3);

    const browsersByMemory = Math.floor(freeMemoryGB / RAM_PER_BROWSER_GB);
    const browsersByCpu = Math.floor(cpuCount / CORES_PER_BROWSER);

    const recommended = Math.max(1, Math.min(browsersByMemory, browsersByCpu, peopleCount));

    return {
        cpuCount,
        totalMemoryGB: Number(totalMemoryGB.toFixed(1)),
        freeMemoryGB: Number(freeMemoryGB.toFixed(1)),
        recommended,
    };
};
