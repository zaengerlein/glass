const sqliteRepository = require('./sqlite.repository');

let authService = null;

function getAuthService() {
    if (!authService) {
        authService = require('../../services/authService');
    }
    return authService;
}

const userRepositoryAdapter = {
    findOrCreate: (user) => {
        return sqliteRepository.findOrCreate(user);
    },

    getById: () => {
        const uid = getAuthService().getCurrentUserId();
        return sqliteRepository.getById(uid);
    },

    update: (updateData) => {
        const uid = getAuthService().getCurrentUserId();
        return sqliteRepository.update({ uid, ...updateData });
    },

    deleteById: () => {
        const uid = getAuthService().getCurrentUserId();
        return sqliteRepository.deleteById(uid);
    }
};

module.exports = {
    ...userRepositoryAdapter
};
