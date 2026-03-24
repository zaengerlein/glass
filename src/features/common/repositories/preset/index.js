const sqliteRepository = require('./sqlite.repository');
const authService = require('../../services/authService');

const presetRepositoryAdapter = {
    getPresets: () => {
        const uid = authService.getCurrentUserId();
        return sqliteRepository.getPresets(uid);
    },

    getPresetTemplates: () => {
        return sqliteRepository.getPresetTemplates();
    },

    create: (options) => {
        const uid = authService.getCurrentUserId();
        return sqliteRepository.create({ uid, ...options });
    },

    update: (id, options) => {
        const uid = authService.getCurrentUserId();
        return sqliteRepository.update(id, options, uid);
    },

    delete: (id) => {
        const uid = authService.getCurrentUserId();
        return sqliteRepository.delete(id, uid);
    },
};

module.exports = presetRepositoryAdapter;
