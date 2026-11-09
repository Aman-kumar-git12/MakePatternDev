import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { api, ApiError } from '../services/api';
import type { Question } from '../types/dsa';

/** The question open in the workspace, kept in sync with the /question/:questionId deep link. */
export function useActiveQuestion() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ questionId?: string }>();
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);
  // Only the most recent open request may win: clicking A then B must open B even if A's
  // response arrives last.
  const requestSeq = useRef(0);

  // Deep link sync for /question/:questionId
  useEffect(() => {
    const routeQuestionId = params.questionId;
    if (routeQuestionId) {
      if (!activeQuestion || activeQuestion.id !== routeQuestionId) {
        const seq = ++requestSeq.current;
        api.getQuestion(routeQuestionId)
          .then((q) => {
            if (seq === requestSeq.current) setActiveQuestion(q);
          })
          .catch((err) => {
            console.error('Failed to resolve route question:', err);
            // Leave only when the question really doesn't exist for this user; stay put when
            // offline or the server is waking up.
            if (seq === requestSeq.current && err instanceof ApiError && (err.status === 404 || err.status === 403)) {
              navigate('/', { replace: true });
            }
          });
      }
    } else {
      if (activeQuestion && !location.pathname.startsWith('/question/')) {
        setActiveQuestion(null);
      }
    }
  }, [params.questionId, location.pathname, activeQuestion, navigate]);

  // Select Question & Navigate to Workspace Route
  const handleSelectQuestion = async (questionId: string) => {
    const seq = ++requestSeq.current;
    try {
      const q = await api.getQuestion(questionId);
      if (seq !== requestSeq.current) return;
      setActiveQuestion(q);
      // q.id, not questionId: a problem opened while it was still saving had a temporary id.
      navigate(`/question/${q.id}`);
    } catch (err) {
      console.error('Failed to open question:', err);
    }
  };

  return { activeQuestion, setActiveQuestion, handleSelectQuestion };
}

export type ActiveQuestionState = ReturnType<typeof useActiveQuestion>;
