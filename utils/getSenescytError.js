export const getSenescytError = async ({
    page,
    senescytErrSpanSelector = 'span.ui-messages-error-detail',
    timeout = 5_000,
}) => {
    let senescytError;
    try {
        const senescytErrSpan = await page.waitForSelector(senescytErrSpanSelector, { timeout, });
        senescytError = await page.evaluate(el => el.textContent, senescytErrSpan);
        return senescytError;
    } catch (error) {
        return senescytError;
    }
}