import { useCallback, useEffect, useState } from 'react';
import PageHeading from '../layout/PageHeading';
import { useCaseSession } from '../../hooks/useCaseSession';
import CaseLanding from './CaseLanding';
import WalkthroughView from './WalkthroughView';
import PracticeSession from './PracticeSession';
import DiagnosticModal from './DiagnosticModal';
import { needsDiagnostic } from '../../utils/caseSessionStorage';
import { submitDiagnostic } from '../../services/interviewApi';

export default function CasePage({ caseType, title }) {
  const session = useCaseSession(caseType);
  const [checkingDiagnostic, setCheckingDiagnostic] = useState(true);
  const [showDiagnostic, setShowDiagnostic] = useState(false);

  useEffect(() => {
    let cancelled = false;
    needsDiagnostic(caseType).then((needed) => {
      if (!cancelled) {
        setShowDiagnostic(needed);
        setCheckingDiagnostic(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [caseType]);

  const handleDiagnosticComplete = useCallback(
    async (answers) => {
      await submitDiagnostic({
        type: caseType,
        ...answers,
      });
      setShowDiagnostic(false);
    },
    [caseType]
  );

  const showWalkthrough =
    session.view === 'walkthrough' ||
    (session.view === 'landing' && session.loading);

  if (checkingDiagnostic) {
    return (
      <div className="case-page font-body text-gray-500 mt-8 text-center">
        Loading...
      </div>
    );
  }

  return (
    <div className="case-page">
      {showDiagnostic && (
        <DiagnosticModal
          caseType={caseType}
          onComplete={handleDiagnosticComplete}
        />
      )}

      {session.view === 'landing' && !showDiagnostic && (
        <PageHeading>{title}</PageHeading>
      )}

      {session.view === 'landing' && !session.loading && !showDiagnostic && (
        <CaseLanding
          onStartWalkthrough={session.startWalkthrough}
          onStartPractice={session.startPractice}
          onSkipToPractice={session.skipToPractice}
          walkthroughDoneToday={session.walkthroughDoneToday}
          loading={session.loading}
        />
      )}

      {showWalkthrough && !showDiagnostic && (
        <WalkthroughView
          walkthroughCase={session.walkthroughCase}
          practiceCase={session.practiceCase}
          loading={session.loading}
          error={session.error}
          onRetry={session.retryGenerate}
          onStartPractice={session.startPractice}
          onSaveToReviewBank={session.saveToReviewBank}
          saving={session.saving}
          saved={session.saved}
        />
      )}

      {session.view === 'practice' && !showDiagnostic && (
        <PracticeSession
          caseType={caseType}
          practiceCase={session.practiceCase}
          onReviewWalkthrough={session.reviewWalkthrough}
          onBackHome={session.goToLanding}
        />
      )}
    </div>
  );
}
