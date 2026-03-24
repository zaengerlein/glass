const sqliteRepository = require('./sqlite.repository');
const authService = require('../../common/services/authService');

const askRepositoryAdapter = {
    addAiMessage: ({ sessionId, role, content, model }) => {
        const uid = authService.getCurrentUserId();
        return sqliteRepository.addAiMessage({ uid, sessionId, role, content, model });
    },
    getAllAiMessagesBySessionId: (sessionId) => {
        return sqliteRepository.getAllAiMessagesBySessionId(sessionId);
    }
};

module.exports = askRepositoryAdapter;
