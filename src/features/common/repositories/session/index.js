const sqliteRepository = require('./sqlite.repository');

let authService = null;

function setAuthService(service) {
    authService = service;
}

const sessionRepositoryAdapter = {
    setAuthService,

    getById: (id) => sqliteRepository.getById(id),

    create: (type = 'ask') => {
        const uid = authService.getCurrentUserId();
        return sqliteRepository.create(uid, type);
    },

    getAllByUserId: () => {
        const uid = authService.getCurrentUserId();
        return sqliteRepository.getAllByUserId(uid);
    },

    updateTitle: (id, title) => sqliteRepository.updateTitle(id, title),

    deleteWithRelatedData: (id) => sqliteRepository.deleteWithRelatedData(id),

    end: (id) => sqliteRepository.end(id),

    updateType: (id, type) => sqliteRepository.updateType(id, type),

    touch: (id) => sqliteRepository.touch(id),

    getOrCreateActive: (requestedType = 'ask') => {
        const uid = authService.getCurrentUserId();
        return sqliteRepository.getOrCreateActive(uid, requestedType);
    },

    endAllActiveSessions: () => {
        const uid = authService.getCurrentUserId();
        return sqliteRepository.endAllActiveSessions(uid);
    },
};

module.exports = sessionRepositoryAdapter;
