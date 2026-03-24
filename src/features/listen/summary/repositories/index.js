const sqliteRepository = require('./sqlite.repository');
const authService = require('../../../common/services/authService');

const summaryRepositoryAdapter = {
    saveSummary: ({ sessionId, tldr, text, bullet_json, action_json, model }) => {
        const uid = authService.getCurrentUserId();
        return sqliteRepository.saveSummary({ uid, sessionId, tldr, text, bullet_json, action_json, model });
    },
    getSummaryBySessionId: (sessionId) => {
        return sqliteRepository.getSummaryBySessionId(sessionId);
    }
};

module.exports = summaryRepositoryAdapter;
