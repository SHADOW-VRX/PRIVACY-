// Version display and logging
(async function() {
    try {
        const response = await fetch('/api/version');
        const versionInfo = await response.json();
        console.log(`🔒 PRIVACY v${versionInfo.version} loaded | Environment: ${versionInfo.environment}`);
        console.log(`✨ Features: ${versionInfo.features.join(', ')}`);
    } catch (error) {
        console.log('🔒 PRIVACY loaded');
    }
})();