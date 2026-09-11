export const article = String.raw`% A little more space to think.
% Welcome to your own corner of Dopnur.
\documentclass[11pt,a4paper]{article}

% Make yourself at home
\usepackage[margin=0.95in]{geometry}
\usepackage{graphicx,amsmath,booktabs}
\usepackage[dvipsnames]{xcolor}
\usepackage{hyperref}
\definecolor{forest}{HTML}{345B48}
\hypersetup{colorlinks=true,allcolors=forest}
\setlength{\parskip}{0.5em}
\setlength{\parindent}{0pt}

\title{\textbf{The quiet architecture of focus}\\[0.4em]
  \large Designing environments for deeper work}
\author{Alex Morgan \\ \small Independent Researcher}
\date{September 2026}

\begin{document}
\maketitle

\begin{abstract}
The spaces in which we think shape the things we create.
This paper explores how intentional environments and
gentle constraints support sustained attention. We propose
a simple framework for designing workspaces that make
room for meaningful, focused work.
\end{abstract}

\section{Introduction}
Good ideas need a little breathing room. In a world of
constant notifications and competing demands, the ability
to focus has become both more valuable and more elusive.
Our tools should help us find that focus, not interrupt it.

Attention restoration theory suggests that thoughtfully
designed environments can replenish cognitive resources
\cite{kaplan1995}. We build on this idea to explore the
relationship between our digital spaces and deep work.

\section{A framework for thoughtful work}
We consider three qualities of a supportive workspace:
\begin{itemize}
  \item \textbf{Clarity.} Keep the essential within reach.
  \item \textbf{Calm.} Reduce unnecessary visual noise.
  \item \textbf{Continuity.} Protect the rhythm of thinking.
\end{itemize}

\subsection{Measuring sustained attention}
For an illustrative focus session, let $a(t)$ represent
attention at time $t$. We define the focus integral as
\begin{equation}
  F(T) = \frac{1}{T}\int_0^T a(t)\,dt.
  \label{eq:focus}
\end{equation}
The aim is not perfect concentration, but a gentler return
to the task at hand whenever our attention wanders.

\begin{figure}[ht]
  \centering
  \includegraphics[width=0.88\linewidth]{figures/focus-study.png}
  \caption{Illustrative attention curves, not experimental data.}
  \label{fig:attention}
\end{figure}

\section{Discussion}
Small changes compound. Fewer interruptions, a clear
starting point, and a comfortable rhythm can transform
the experience of writing. The framework is a design
proposal; controlled studies are needed to test its impact.

\section{Conclusion}
The best workspace leaves room for you. By designing for
clarity, calm, and continuity, we can make the act of
thinking feel a little more natural.

\bibliographystyle{plain}
\bibliography{references}
\end{document}
`;

const references = String.raw`@article{kaplan1995,
  author  = {Kaplan, Stephen},
  title   = {The restorative benefits of nature: Toward an integrative framework},
  journal = {Journal of Environmental Psychology},
  year    = {1995},
  volume  = {15},
  number  = {3},
  pages   = {169--182},
  doi     = {10.1016/0272-4944(95)90001-2}
}

@book{knuth1984,
  author    = {Knuth, Donald E.},
  title     = {The TeXbook},
  publisher = {Addison-Wesley},
  year      = {1984}
}
`;

export const templates = [
  {
    id: "article",
    name: "Research article",
    description: "A thoughtful starting point for your next big idea.",
    color: "sage",
    label: "RESEARCH",
    files: [
      { name: "main.tex", content: article },
      { name: "references.bib", content: references },
      {
        name: "notes.md",
        content:
          "# A little space for your thoughts\n\n## Before you begin\n- Give your paper a title that feels like you.\n- Add your sources to references.bib.\n- Press ⌘/Ctrl + Enter to compile.\n\n## Ideas to explore\n- What does a calmer digital workspace feel like?\n- How could we measure attention without interrupting it?\n\nThis example is a writing template, not a report of an actual study.\n",
      },
    ],
  },
  {
    id: "blank",
    name: "Blank canvas",
    description: "Just you, a fresh page, and all the possibilities.",
    color: "cream",
    label: "START FRESH",
    files: [
      {
        name: "main.tex",
        content: String.raw`\documentclass[11pt]{article}
\usepackage[margin=1in]{geometry}
\usepackage{amsmath,graphicx,hyperref}
\title{Something wonderful}
\author{Your name}
\date{\today}

\begin{document}
\maketitle

\section{A beginning}
Every good idea starts somewhere.

\end{document}
`,
      },
      { name: "references.bib", content: "% Your references go here.\n" },
    ],
  },
  {
    id: "thesis",
    name: "Thesis & dissertation",
    description: "A home for the work you have poured yourself into.",
    color: "peach",
    label: "LONG FORM",
    files: [
      {
        name: "main.tex",
        content: String.raw`\documentclass[12pt,a4paper]{report}
\usepackage[margin=1in]{geometry}
\usepackage{amsmath,graphicx,hyperref}
\title{An exploration of meaningful things}
\author{Your name \\ Your university}
\date{\today}
\begin{document}
\maketitle
\begin{abstract}
Summarize your research question, approach, and contribution here.
\end{abstract}
\tableofcontents
\input{chapters/introduction}
\chapter{Background}
Introduce the literature that informs your work.
\chapter{Methodology}
Describe your approach so others can reproduce it.
\chapter{Conclusion}
Reflect on your findings and the questions that remain.
\bibliographystyle{plain}
\bibliography{references}
\end{document}
`,
      },
      {
        name: "chapters/introduction.tex",
        content:
          "\chapter{Introduction}\n\nStart with the question that made you curious.\n\n\section{Research questions}\nWhat would you like to understand?\n",
      },
      { name: "references.bib", content: references },
    ],
  },
  {
    id: "letter",
    name: "A lovely letter",
    description: "For words that deserve a little extra care.",
    color: "rose",
    label: "PERSONAL",
    files: [
      {
        name: "main.tex",
        content: String.raw`\documentclass[11pt]{letter}
\usepackage[margin=1in]{geometry}
\signature{Your name}
\address{Your address \\ Your city}
\begin{document}
\begin{letter}{Recipient name \\ Recipient address}
\opening{Dear friend,}
I have been meaning to write to you.
\closing{With warm wishes,}
\end{letter}
\end{document}
`,
      },
    ],
  },
];
