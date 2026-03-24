const sqliteRepository = require('./sqlite.repository');
const authService = require('../../../common/services/authService');

const sttRepositoryAdapter = {
    addTranscript: ({ sessionId, speaker, text }) => {
        const uid = authService.getCurrentUserId();
        return sqliteRepository.addTranscript({ uid, sessionId, speaker, text });
    },
    getAllTranscriptsBySessionId: (sessionId) => {
        return sqliteRepository.getAllTranscriptsBySessionId(sessionId);
    }
};

module.exports = sttRepositoryAdapter;
