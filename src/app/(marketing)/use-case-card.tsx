import type { ReactNode } from "react";

export type UseCase = {
  title: string;
  description: string;
  illustration: ReactNode;
};

export function UseCaseCard({ useCase }: { useCase: UseCase }) {
  return (
    <article className="uc-panel">
      <div className="uc-art" aria-hidden="true">{useCase.illustration}</div>
      <div className="uc-caption">
        <h3 className="uc-title">{useCase.title}</h3>
        <p className="uc-description">{useCase.description}</p>
      </div>
    </article>
  );
}
