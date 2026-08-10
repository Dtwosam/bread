'use client';

import { useState } from 'react';

import {
  EMPTY_CREATE_TOKEN_DRAFT,
  TokenForm,
  type CreateTokenDraft,
} from '../../components/create/token-form';
import {
  LaunchReview,
  type LaunchReviewModel,
} from '../../components/create/launch-review';
import styles from '../../components/create/create.module.css';

type CreateStep = 'FORM' | 'REVIEW';

export default function CreatePage() {
  const [step, setStep] = useState<CreateStep>('FORM');
  const [draft, setDraft] = useState<CreateTokenDraft>(EMPTY_CREATE_TOKEN_DRAFT);
  const [review] = useState<LaunchReviewModel | null>(null);

  return (
    <main className={`${styles.layout} bread-create-layout`}>
      {step === 'FORM' ? (
        <div className={`${styles.formRegion} bread-create-form-region`}>
          <TokenForm
            draft={draft}
            onChange={setDraft}
            onReview={() => setStep('REVIEW')}
          />
        </div>
      ) : (
        <div className={`${styles.reviewRegion} bread-launch-review-region`}>
          <LaunchReview
            review={review}
            onBack={() => setStep('FORM')}
            onLaunch={() => undefined}
          />
        </div>
      )}
    </main>
  );
}
