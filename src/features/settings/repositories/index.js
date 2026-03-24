const sqliteRepository = require('./sqlite.repository');
const authService = require('../../common/services/authService');

const settingsRepositoryAdapter = {
    getPresets: () => {
        const uid = authService.getCurrentUserId();
        return sqliteRepository.getPresets(uid);
    },

    getPresetTemplates: () => {
        return sqliteRepository.getPresetTemplates();
    },

    createPreset: (options) => {
        const uid = authService.getCurrentUserId();
        return sqliteRepository.createPreset({ uid, ...options });
    },

    updatePreset: (id, options) => {
        const uid = authService.getCurrentUserId();
        return sqliteRepository.updatePreset(id, options, uid);
    },

    deletePreset: (id) => {
        const uid = authService.getCurrentUserId();
        return sqliteRepository.deletePreset(id, uid);
    },

    getAutoUpdate: () => {
        const uid = authService.getCurrentUserId();
        return sqliteRepository.getAutoUpdate(uid);
    },

    setAutoUpdate: (isEnabled) => {
        const uid = authService.getCurrentUserId();
        return sqliteRepository.setAutoUpdate(uid, isEnabled);
    },
};

module.exports = settingsRepositoryAdapter;
