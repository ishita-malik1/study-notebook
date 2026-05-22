import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { generateCasePair, savePracticeSession } from '../services/caseApi';
import { TPM_STEP_OVERRIDES } from '../constants/caseFramework';
import {
  hasWalkthroughToday,
  incrementSessionCount,
  markWalkthroughToday,
  getLearningProfile as fetchProfileForGenerate,
} from '../utils/caseSessionStorage';

export function useCaseSession(caseType) {
  const getTodayStr = () => format(new Date(), 'yyyy-MM-dd');

  const [view, setView] = useState(() => {
    const savedDate = localStorage.getItem(`sn_session_${caseType}_date`);
    if (savedDate === getTodayStr()) {
      return localStorage.getItem(`sn_session_${caseType}_view`) || 'landing';
    }
    return 'landing';
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [walkthroughCase, setWalkthroughCase] = useState(() => {
    const savedDate = localStorage.getItem(`sn_session_${caseType}_date`);
    if (savedDate === getTodayStr()) {
      const data = localStorage.getItem(`sn_session_${caseType}_walkthroughCase`);
      try {
        return data ? JSON.parse(data) : null;
      } catch {
        return null;
      }
    }
    return null;
  });

  const [practiceCase, setPracticeCase] = useState(() => {
    const savedDate = localStorage.getItem(`sn_session_${caseType}_date`);
    if (savedDate === getTodayStr()) {
      const data = localStorage.getItem(`sn_session_${caseType}_practiceCase`);
      try {
        return data ? JSON.parse(data) : null;
      } catch {
        return null;
      }
    }
    return null;
  });

  const [saving, setSaving] = useState(false);
  
  const [saved, setSaved] = useState(() => {
    const savedDate = localStorage.getItem(`sn_session_${caseType}_date`);
    if (savedDate === getTodayStr()) {
      return localStorage.getItem(`sn_session_${caseType}_saved`) === 'true';
    }
    return false;
  });

  const [walkthroughDoneToday, setWalkthroughDoneToday] = useState(() =>
    hasWalkthroughToday(caseType)
  );

  const stepOverrides = caseType === 'tpm' ? TPM_STEP_OVERRIDES : null;

  // Persist view state
  useEffect(() => {
    const today = getTodayStr();
    localStorage.setItem(`sn_session_${caseType}_date`, today);
    localStorage.setItem(`sn_session_${caseType}_view`, view);
  }, [view, caseType]);

  // Persist walkthroughCase state
  useEffect(() => {
    const today = getTodayStr();
    localStorage.setItem(`sn_session_${caseType}_date`, today);
    if (walkthroughCase) {
      localStorage.setItem(
        `sn_session_${caseType}_walkthroughCase`,
        JSON.stringify(walkthroughCase)
      );
    } else {
      localStorage.removeItem(`sn_session_${caseType}_walkthroughCase`);
    }
  }, [walkthroughCase, caseType]);

  // Persist practiceCase state
  useEffect(() => {
    const today = getTodayStr();
    localStorage.setItem(`sn_session_${caseType}_date`, today);
    if (practiceCase) {
      localStorage.setItem(
        `sn_session_${caseType}_practiceCase`,
        JSON.stringify(practiceCase)
      );
    } else {
      localStorage.removeItem(`sn_session_${caseType}_practiceCase`);
    }
  }, [practiceCase, caseType]);

  // Persist saved state
  useEffect(() => {
    const today = getTodayStr();
    localStorage.setItem(`sn_session_${caseType}_date`, today);
    localStorage.setItem(`sn_session_${caseType}_saved`, String(saved));
  }, [saved, caseType]);

  const startWalkthrough = useCallback(async () => {
    setView('walkthrough');
    setLoading(true);
    setError(null);
    setWalkthroughCase(null);
    setPracticeCase(null);
    setSaved(false);

    try {
      const learningProfile = await fetchProfileForGenerate(caseType);
      const result = await generateCasePair({
        type: caseType,
        learningProfile,
        stepOverrides,
      });

      setWalkthroughCase(result.walkthroughCase);
      setPracticeCase(result.practiceCase);
      incrementSessionCount(caseType);
      markWalkthroughToday(caseType);
      setWalkthroughDoneToday(true);
    } catch (err) {
      setError(err.message || 'Failed to generate case');
    } finally {
      setLoading(false);
    }
  }, [caseType, stepOverrides]);

  const retryGenerate = useCallback(() => {
    startWalkthrough();
  }, [startWalkthrough]);

  const goToLanding = useCallback(() => {
    setView('landing');
    setError(null);
  }, []);

  const skipToPractice = useCallback(() => {
    setView('practice');
  }, []);

  const startPractice = useCallback(() => {
    if (!practiceCase) return;
    setView('practice');
  }, [practiceCase]);

  const reviewWalkthrough = useCallback(() => {
    if (walkthroughCase) {
      setView('walkthrough');
      setError(null);
    } else {
      startWalkthrough();
    }
  }, [walkthroughCase, startWalkthrough]);

  const saveToReviewBank = useCallback(async () => {
    if (!walkthroughCase || !practiceCase) return;

    setSaving(true);
    try {
      await savePracticeSession({
        date: format(new Date(), 'yyyy-MM-dd'),
        type: caseType,
        mode: 'walkthrough',
        caseMetadata: {
          problemType: walkthroughCase.problemType,
          company: walkthroughCase.company,
          domain: walkthroughCase.domain,
          problemStatement: walkthroughCase.problemStatement,
          companyProfile: walkthroughCase.companyProfile,
          situationBrief: walkthroughCase.situationBrief,
          theAsk: walkthroughCase.theAsk,
        },
        pairedPracticeCase: {
          problemType: practiceCase.problemType,
          company: practiceCase.company,
          domain: practiceCase.domain,
          problemStatement: practiceCase.problemStatement,
          companyProfile: practiceCase.companyProfile,
          situationBrief: practiceCase.situationBrief,
          theAsk: practiceCase.theAsk,
        },
        conversation: walkthroughCase.conversation,
      });
      setSaved(true);
    } catch (err) {
      setError(err.message || 'Failed to save session');
    } finally {
      setSaving(false);
    }
  }, [walkthroughCase, practiceCase, caseType]);

  return {
    view,
    loading,
    error,
    walkthroughCase,
    practiceCase,
    saving,
    saved,
    walkthroughDoneToday,
    startWalkthrough,
    retryGenerate,
    goToLanding,
    skipToPractice,
    startPractice,
    reviewWalkthrough,
    saveToReviewBank,
  };
}
