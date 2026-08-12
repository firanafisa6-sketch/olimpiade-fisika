"use client";

import { QuestionRenderer, StimulusRenderer, type OptionLabel, type PublishedQuestion, type PublishedStimulus } from "@seleksi/question-renderer";
import { TopUtilities } from "@seleksi/ui";
import { AppLogo } from "@/components/app-logo";
import { Clock3, Flag, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const stimulus: PublishedStimulus = {
  id: "ENG-READ-001",
  title: "Renewable Energy",
  instructionsHtml: "<p>Read the following text to answer questions 1–5.</p>",
  contentHtml: "<p>Renewable energy has become increasingly important as countries seek cleaner ways to meet growing energy demands. Solar and wind power are now among the most widely adopted renewable sources.</p><p>Although the initial cost of renewable infrastructure can be high, technological improvements have continued to reduce costs. Many governments also provide incentives to encourage wider adoption.</p><p>Experts argue that no single energy source can solve every problem. A balanced system, supported by efficient storage and modern electricity grids, is needed to provide reliable power.</p>"
};

const stems = [
  ["What is the main idea of the text?", ["Renewable energy is increasingly important and needs supporting systems.", "Fossil fuels are the only reliable energy source.", "Renewable technology is becoming more expensive.", "Governments oppose renewable energy.", "Electricity demand is decreasing."]],
  ["The word “incentives” in paragraph two is closest in meaning to...", ["penalties", "encouragements", "measurements", "complaints", "restrictions"]],
  ["According to the text, what has helped reduce renewable energy costs?", ["Lower electricity demand", "Fewer government programs", "Technological improvements", "Higher fossil fuel use", "Smaller power grids"]],
  ["What can be inferred from the final paragraph?", ["One source alone is sufficient.", "Energy storage is unnecessary.", "Reliable power requires an integrated approach.", "Modern grids increase every cost.", "Experts reject renewable energy."]],
  ["What is the author’s purpose?", ["To entertain readers with a fictional story", "To explain the development and needs of renewable energy", "To criticize all government policies", "To advertise a particular solar product", "To compare two private companies"]]
];

const questions: PublishedQuestion[] = stems.map(([stem, options], index) => ({
  id: `ENG-00${index + 1}`,
  number: index + 1,
  contentHtml: `<p>${stem}</p>`,
  options: (options as string[]).map((content, optionIndex) => ({
    id: `ENG-00${index + 1}-${optionIndex}`,
    label: (["A", "B", "C", "D", "E"] as OptionLabel[])[optionIndex],
    contentHtml: `<p>${content}</p>`
  }))
}));

export function ExamDemo() {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, OptionLabel>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [seconds, setSeconds] = useState(45 * 60);

  useEffect(() => {
    const saved = window.localStorage.getItem("seleksi-demo-answers");
    if (saved) setAnswers(JSON.parse(saved));
  }, []);

  useEffect(() => {
    window.localStorage.setItem("seleksi-demo-answers", JSON.stringify(answers));
  }, [answers]);

  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const time = useMemo(() => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`, [seconds]);
  const question = questions[current];

  return (
    <div className="exam-root">
      <header className="exam-topbar">
        <div className="exam-brand"><div className="exam-brand-mark"><AppLogo /></div><div><strong>Olimpiade Fisika</strong><span>Simulasi Bahasa Inggris</span></div></div>
        <TopUtilities />
      </header>
      <main className="exam-main">
        <section className="card exam-statusbar">
          <strong>Soal {current + 1} dari {questions.length}</strong>
          <div className="progress-track" aria-label="Progres ujian"><div className="progress-fill" style={{width:`${((current+1)/questions.length)*100}%`}} /></div>
          <div className="timer"><Clock3 size={19}/>{time}</div>
        </section>
        <div className="exam-layout">
          <div className="stimulus-column"><StimulusRenderer stimulus={stimulus}/></div>
          <div className="question-column">
            <QuestionRenderer question={question} value={answers[question.id]} onChange={(value)=>setAnswers(currentAnswers=>({...currentAnswers,[question.id]:value}))}/>
            <div className="exam-actions">
              <button className="secondary-button" disabled={current===0} onClick={()=>setCurrent(index=>Math.max(0,index-1))}>Sebelumnya</button>
              <button className="secondary-button" onClick={()=>setFlagged(currentFlags=>({...currentFlags,[question.id]:!currentFlags[question.id]}))}><Flag size={17}/>{flagged[question.id]?"Hapus tanda":"Tandai ragu"}</button>
              {current < questions.length-1 ? <button className="primary-button" onClick={()=>setCurrent(index=>Math.min(questions.length-1,index+1))}>Berikutnya</button> : <button className="danger-button"><Send size={17}/>Kirim jawaban</button>}
            </div>
          </div>
          <aside className="card navigator">
            <strong>Navigasi soal</strong>
            <div className="number-grid">
              {questions.map((item,index)=><button key={item.id} className={`number-button ${index===current?"is-current":""} ${answers[item.id]?"is-answered":""}`} onClick={()=>setCurrent(index)}>{index+1}</button>)}
            </div>
            <div className="navigator-actions"><div className="muted-text">Terjawab: {Object.keys(answers).length}/{questions.length}</div><button className="danger-button"><Send size={17}/>Selesaikan ujian</button></div>
          </aside>
        </div>
      </main>
    </div>
  );
}
