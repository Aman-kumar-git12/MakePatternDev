import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { api } from '../services/api';
import type { Question } from '../types/dsa';

/** The question open in the workspace, kept in sync with the /question/:questionId deep link. */
export function useActiveQuestion() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ questionId?: string }>();
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);

  // Deep link sync for /question/:questionId
  useEffect(() => {
    const routeQuestionId = params.questionId;
    if (routeQuestionId) {
      if (!activeQuestion || activeQuestion.id !== routeQuestionId) {
        api.getQuestion(routeQuestionId)
          .then((q) => setActiveQuestion(q))
          .catch((err) => {
            console.error('Failed to resolve route question:', err);
            navigate('/', { replace: true });
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
    try {
      const q = await api.getQuestion(questionId);
      setActiveQuestion(q);
      navigate(`/question/${questionId}`);
    } catch (err) {
      console.error('Failed to open question:', err);
    }
  };

  return { activeQuestion, setActiveQuestion, handleSelectQuestion };
}

export type ActiveQuestionState = ReturnType<typeof useActiveQuestion>;
