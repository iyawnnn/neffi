import { Reveal } from "./reveal";
import { UseCaseCard, type UseCase } from "./use-case-card";
import { UseCasesCarousel } from "./use-cases-carousel";
import {
  CareerOpportunityIllustration,
  ClientMeetingIllustration,
  CreativeWorkIllustration,
  EverydayConnectionIllustration,
  NetworkingEventIllustration,
  SalesConversationIllustration,
} from "./use-case-illustrations";
import "./use-cases.css";

const useCases: UseCase[] = [
  {
    title: "Client meetings",
    description: "Share your details before the conversation moves on.",
    illustration: <ClientMeetingIllustration />,
  },
  {
    title: "Networking events",
    description: "Keep the conversation going after the event. Share your details in a tap, so new connections know where to find you.",
    illustration: <NetworkingEventIllustration />,
  },
  {
    title: "Freelance & creative work",
    description: "Put your portfolio, socials, and contact details within reach.",
    illustration: <CreativeWorkIllustration />,
  },
  {
    title: "Sales conversations",
    description: "Give prospects a clear next step. Keep your details and work together, so they can pick up the conversation later.",
    illustration: <SalesConversationIllustration />,
  },
  {
    title: "Careers & opportunities",
    description: "Share your experience and work when an opportunity opens up.",
    illustration: <CareerOpportunityIllustration />,
  },
  {
    title: "Everyday connections",
    description: "A good connection can happen anywhere. Share who you are in the moment, with an easy way to get back in touch.",
    illustration: <EverydayConnectionIllustration />,
  },
];

export function UseCasesSection() {
  return (
    <section aria-labelledby="use-cases-heading" className="use-cases-section bg-canvas">
      <Reveal className="uc-reveal uc-content">
        <UseCasesCarousel heading={
          <>
            <h2 id="use-cases-heading" className="uc-heading">
              For every kind of<br />introduction.
            </h2>
            <p className="uc-intro">
              From work to everyday moments, Neffi gives every introduction an easy next step.
            </p>
          </>
        }>
          {useCases.map((useCase) => (
            <li key={useCase.title} className="uc-item">
              <UseCaseCard useCase={useCase} />
            </li>
          ))}
        </UseCasesCarousel>
      </Reveal>
    </section>
  );
}
