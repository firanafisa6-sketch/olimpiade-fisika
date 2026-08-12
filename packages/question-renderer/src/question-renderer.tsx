"use client";

import { RichContent } from "@seleksi/ui";
import type { OptionLabel, PublishedQuestion, PublishedStimulus } from "./types";

export function StimulusRenderer({ stimulus }: { stimulus: PublishedStimulus }) {
  return (
    <section className="stimulus-card" aria-labelledby={`stimulus-${stimulus.id}`}>
      <p className="eyebrow">Stimulus</p>
      <h2 id={`stimulus-${stimulus.id}`}>{stimulus.title}</h2>
      <RichContent html={stimulus.instructionsHtml} className="stimulus-instruction" />
      <RichContent html={stimulus.contentHtml} />
      {stimulus.media?.map((asset) => (
        <figure key={asset.id} className="question-media">
          {asset.type === "IMAGE" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={asset.url} alt={asset.alt ?? "Gambar stimulus"} />
          ) : (
            <audio controls preload="metadata" src={asset.url} />
          )}
          {asset.caption && <figcaption>{asset.caption}</figcaption>}
        </figure>
      ))}
    </section>
  );
}

interface QuestionRendererProps {
  question: PublishedQuestion;
  value?: OptionLabel;
  onChange: (value: OptionLabel) => void;
}

export function QuestionRenderer({ question, value, onChange }: QuestionRendererProps) {
  return (
    <section className="question-card" aria-labelledby={`question-${question.id}`}>
      <div className="question-heading">
        <span className="question-number">{question.number}</span>
        <RichContent id={`question-${question.id}`} html={question.contentHtml} />
      </div>
      {question.media?.map((asset) => (
        <figure key={asset.id} className="question-media">
          {asset.type === "IMAGE" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={asset.url} alt={asset.alt ?? "Gambar soal"} />
          ) : (
            <audio controls preload="metadata" src={asset.url} />
          )}
        </figure>
      ))}
      <div className="option-list">
        {question.options.map((option) => (
          <label key={option.id} className={`option-item ${value === option.label ? "is-selected" : ""}`}>
            <input
              type="radio"
              name={`question-${question.id}`}
              value={option.label}
              checked={value === option.label}
              onChange={() => onChange(option.label)}
            />
            <span className="option-label">{option.label}</span>
            <RichContent html={option.contentHtml} />
          </label>
        ))}
      </div>
    </section>
  );
}
