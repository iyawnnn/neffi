"use client";

import { ArrowRight, CreditCard, Minus, Nfc, Plus, QrCode, ShoppingBag, Truck, UserRound, Wrench } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SectionDivider } from "../section-divider";
import { helpCategories, legacyHelpCategories } from "./help-data";

const shortcuts = [
  { label: "How to order", description: "Price, payment, and ordering.", mobileDescription: "Price and ordering.", icon: ShoppingBag, href: "#buying-payment" },
  { label: "Payment & delivery", description: "Payment methods and shipping.", mobileDescription: "Payment and shipping.", icon: CreditCard, href: "#shipping-delivery" },
  { label: "Activate my Neffi", description: "QR, activation code, and setup.", mobileDescription: "QR and activation.", icon: QrCode, href: "#activation" },
  { label: "Card isn’t tapping", description: "NFC checks and QR fallback.", mobileDescription: "NFC and QR fallback.", icon: Nfc, href: "#troubleshooting" },
];

const categoryIcons = [ShoppingBag, Truck, QrCode, Nfc, UserRound, Wrench];
const anchorAliases: Record<string, string> = {
  ...legacyHelpCategories,
  buying: "buying-ordering",
  "buying-payment": "buying-ordering",
  "shipping-delivery": "shipping",
};

export function HelpBrowser() {
  const [openArticles, setOpenArticles] = useState<Set<string>>(() => new Set());

  function toggleArticle(id: string) {
    setOpenArticles(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <section className="mp-section help-hero" aria-labelledby="help-title">
        <div className="mp-container">
          <p className="help-eyebrow">Neffi help</p>
          <h1 id="help-title" className="mp-title">Find the answer.<br /> Keep moving.</h1>
          <p className="mp-lead">Help with ordering, delivery, activation, sharing, and your Neffi account.</p>
          <nav aria-label="Help shortcuts" className="help-quick">
            <div>{shortcuts.map(({ label, description, mobileDescription, icon: Icon, href }) => (
              <a key={label} href={href}>
                <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
                <span><strong>{label}</strong><span className="help-shortcut-description">{description}</span><span className="help-shortcut-description-mobile">{mobileDescription}</span></span>
                <ArrowRight size={16} aria-hidden="true" />
              </a>
            ))}</div>
          </nav>
        </div>
      </section>
      <SectionDivider />
      <section className="mp-section help-content" aria-label="Browse help">
        <div id="help-browser" className="mp-container help-browser">
            {helpCategories.map((category, index) => {
              const Icon = categoryIcons[index];
              return (
              <section key={category.id} id={category.id} aria-labelledby={`help-category-${category.id}`} className="help-category">
                {Object.entries(anchorAliases).filter(([, target]) => target === category.id).map(([id]) => <span className="help-anchor" id={id} key={id} aria-hidden="true" />)}
                <header className="help-category-header">
                  <Icon size={21} strokeWidth={1.5} aria-hidden="true" />
                  <h2 id={`help-category-${category.id}`}>{category.title}</h2>
                  <p className="help-result-count">{category.articles.length} answers</p>
                </header>
                <div className="help-questions">
                  {category.articles.map(article => {
                    const open = openArticles.has(article.id);
                    const external = article.link?.href.startsWith("https://");
                    return <div key={article.id} className="help-question">
                      <h3><button type="button" id={`help-question-${article.id}`} aria-expanded={open} aria-controls={`help-answer-${article.id}`} onClick={() => toggleArticle(article.id)}>
                        <span>{article.question}</span>{open ? <Minus size={18} aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}
                      </button></h3>
                      <div id={`help-answer-${article.id}`} aria-labelledby={`help-question-${article.id}`} aria-hidden={!open} inert={!open} data-open={open} className="help-answer">
                        <div className="help-answer-inner">
                          <div className="help-answer-copy">
                            <p>{article.answer}</p>
                            {article.link && <Link href={article.link.href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>{article.link.label}<ArrowRight size={15} aria-hidden="true" /></Link>}
                          </div>
                        </div>
                      </div>
                    </div>;
                  })}
                </div>
              </section>
              );
            })}
        </div>
      </section>
    </>
  );
}
