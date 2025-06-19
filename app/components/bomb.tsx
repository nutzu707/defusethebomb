"use client"

import { CSSProperties, useRef, useState, useEffect } from "react";

const digitalFontStyle: CSSProperties = {
  fontFamily: "'Digital7', monospace",
};

const digitalFontFace = `
@font-face {
  font-family: 'Digital7';
  src: url('/digital-7.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
}
`;

// Red timer shadow
const timerTextShadowRed = `
  0 0 16px #ff0000,
  0 0 32px #ff0000,
  0 2px 8px #000,
  0 0 2px #fff
`;

// Green timer shadow
const timerTextShadowGreen = `
  0 0 16px #22ff22,
  0 0 32px #22ff22,
  0 2px 8px #000,
  0 0 2px #fff
`;

function formatTime(ms: number) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const centiseconds = Math.floor((ms % 1000) / 10);
  return (
    String(minutes).padStart(2, "0") +
    ":" +
    String(seconds).padStart(2, "0") +
    ":" +
    String(centiseconds).padStart(2, "0")
  );
}

// Fisher-Yates shuffle
function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

type Question = {
  question: string;
  options: string[];
  answer: string;
};

export default function Bomb() {
  const [timeLeft, setTimeLeft] = useState(60000); // 1 minute in ms
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // For accurate timer: store the timestamp when the timer started or resumed
  const startTimestampRef = useRef<number | null>(null);
  const lastTimeLeftRef = useRef<number>(60000);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answerStatus, setAnswerStatus] = useState<"correct" | "wrong" | null>(null);
  const [quizStarted, setQuizStarted] = useState(false);

  // Track if quiz is over due to time running out
  const [timeExpired, setTimeExpired] = useState(false);

  // Track the time remaining when the bomb is defused
  const [defuseTime, setDefuseTime] = useState<number | null>(null);

  // Track number of correct answers
  const [correctCount, setCorrectCount] = useState(0);

  // Animation state for -5
  const [showMinusFive, setShowMinusFive] = useState(false);

  // Fetch and shuffle all questions on mount or on retry
  const fetchQuestions = () => {
    fetch("/questions.json")
      .then((res) => res.json())
      .then((data: Question[]) => {
        const shuffled = shuffle(data).map((q) => ({
          ...q,
          options: shuffle(q.options),
        }));
        setQuestions(shuffled);
      });
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  // Accurate timer logic using timestamps
  useEffect(() => {
    if (running && timeLeft > 0) {
      // Set the start timestamp and lastTimeLeftRef
      if (startTimestampRef.current === null) {
        startTimestampRef.current = performance.now();
        lastTimeLeftRef.current = timeLeft;
      }
      intervalRef.current = setInterval(() => {
        if (startTimestampRef.current !== null) {
          const elapsed = performance.now() - startTimestampRef.current;
          const newTimeLeft = Math.max(0, Math.round(lastTimeLeftRef.current - elapsed));
          setTimeLeft(newTimeLeft);
          if (newTimeLeft <= 0) {
            clearInterval(intervalRef.current!);
            setTimeExpired(true);
            setRunning(false);
          }
        }
      }, 50);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);
  // ^^^ intentionally omitting timeLeft from deps to avoid breaking timer logic

  // When question changes, reset selection
  useEffect(() => {
    if (questions.length > 0 && current < questions.length) {
      setSelected(null);
      setAnswerStatus(null);
    }
  }, [current, questions]);

  // If quiz is finished before time runs out, stop timer
  useEffect(() => {
    if ((current >= questions.length || correctCount >= 6) && running) {
      setRunning(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }, [current, questions.length, running, correctCount]);

  // If time runs out before quiz is done, jump to "other" scenario
  useEffect(() => {
    if (timeExpired && quizStarted && current < questions.length && correctCount < 6) {
      setCurrent(questions.length); // Jump to end
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeExpired]);

  // Capture the time left when the bomb is defused (6 correct before time runs out)
  useEffect(() => {
    if (
      correctCount >= 6 &&
      !timeExpired &&
      timeLeft > 0 &&
      defuseTime === null
    ) {
      setDefuseTime(timeLeft);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [correctCount, timeExpired, timeLeft, defuseTime]);

  // Animation effect for -5
  useEffect(() => {
    if (showMinusFive) {
      const timeout = setTimeout(() => {
        setShowMinusFive(false);
      }, 900); // match animation duration
      return () => clearTimeout(timeout);
    }
  }, [showMinusFive]);

  const handleStart = () => {
    if (!running && timeLeft > 0) {
      setRunning(true);
      setQuizStarted(true);
      setTimeExpired(false);
      setDefuseTime(null);
      setCorrectCount(0);
      setCurrent(0);
      // Reset timer state
      startTimestampRef.current = null;
      lastTimeLeftRef.current = 60000;
      setTimeLeft(60000);
    }
  };

  const handleOptionClick = (idx: number) => {
    if (selected !== null) return; // Prevent double answer
    setSelected(idx);
    const q = questions[current];
    const chosen = q.options[idx];
    if (chosen === q.answer) {
      setAnswerStatus("correct");
      setCorrectCount((prev) => prev + 1);
    } else {
      setAnswerStatus("wrong");
      // Subtract 5 seconds from both timeLeft and lastTimeLeftRef
      setShowMinusFive(true); // trigger -5 animation
      setTimeLeft((prev) => {
        const newTime = Math.max(0, prev - 5000);
        lastTimeLeftRef.current = newTime;
        // Also update startTimestampRef so timer continues smoothly
        if (startTimestampRef.current !== null) {
          startTimestampRef.current = performance.now();
        }
        return newTime;
      });
    }
    // Move to next question after short delay
    setTimeout(() => {
      setCurrent((prev) => prev + 1);
    }, 800);
  };

  const handleRetry = () => {
    setTimeLeft(60000);
    setRunning(false);
    setCurrent(0);
    setSelected(null);
    setAnswerStatus(null);
    setQuizStarted(false);
    setTimeExpired(false);
    setDefuseTime(null);
    setCorrectCount(0);
    fetchQuestions();
    // Reset timer state
    startTimestampRef.current = null;
    lastTimeLeftRef.current = 60000;
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  // The quiz is done if you have 6 correct answers, or you have answered all questions, or time expired
  const quizDone = correctCount >= 6 || current >= questions.length || timeExpired;

  // You win if you got 6 correct before time ran out
  const finishedBeforeTime = correctCount >= 6 && !timeExpired && timeLeft > 0;

  let timerDisplay;
  let timerClass =
    "text-8xl absolute w-90 justify-center rotate-0.5 ml-16 top-[23.1%] pointer-events-none";
  let timerTextShadowStyle: React.CSSProperties = {};

  if (quizDone) {
    if (finishedBeforeTime) {
      timerDisplay = formatTime(defuseTime !== null ? defuseTime : timeLeft);
      timerClass += " text-green-400 timer-green-shadow";
      timerTextShadowStyle = {
        textShadow: timerTextShadowGreen,
      };
    } else {
      timerDisplay = "UNLUCKY!";
      timerClass += " text-red-500 timer-red-shadow";
      timerTextShadowStyle = {
        textShadow: timerTextShadowRed,
      };
    }
  } else {
    timerDisplay = formatTime(timeLeft);
    timerClass += " text-red-500 timer-red-shadow";
    timerTextShadowStyle = {
      textShadow: timerTextShadowRed,
    };
  }

  return (
    <>
      <style>{digitalFontFace}</style>
      {/* -5 animation style and timer shadow */}
      <style>{`
        @keyframes minusFivePop {
          0% {
            opacity: 0;
            transform: translateY(0) scale(0.7);
          }
          10% {
            opacity: 1;
            transform: translateY(-10px) scale(1.2);
          }
          60% {
            opacity: 1;
            transform: translateY(-60px) scale(1.2);
          }
          100% {
            opacity: 0;
            transform: translateY(-120px) scale(0.7);
          }
        }
        .minus-five-anim {
          position: absolute;
          left: 50%;
          top: 7%;
          transform: translateX(-50%);
          z-index: 30;
          font-size: 7rem;
          font-family: 'Digital7', monospace;
          color: #F44336;
          text-shadow:
            0 0 16px #F44336,
            0 0 32px #F44336,
            0 2px 8px #000,
            0 0 2px #fff;
          font-weight: bold;
          letter-spacing: 0.1em;
          pointer-events: none;
          animation: minusFivePop 0.9s cubic-bezier(.4,1.6,.6,1) forwards;
          user-select: none;
        }
        .timer-red-shadow {
          text-shadow:
            0 0 16px #F44336,
            0 0 32px #F44336,
            0 2px 8px #000,
            0 0 2px #fff;
        }
        .timer-green-shadow {
          text-shadow:
            0 0 16px #22ff22,
            0 0 32px #22ff22,
            0 2px 8px #000,
            0 0 2px #fff;
        }
      `}</style>
      <div className="w-full">
        <div className="flex w-full">
          <div className="w-1/2 relative flex items-center justify-center">
            <img
              src="/csbomb.svg"
              alt="bomb"
              className="w-full h-full p-16 select-none"
              draggable="false"
              style={{ userSelect: "none", WebkitUserDrag: "none" } as React.CSSProperties}
            />
            {/* -5 animation */}
            {showMinusFive && (
              <span className="minus-five-anim">-5</span>
            )}
            <h1
              style={{ ...digitalFontStyle, ...timerTextShadowStyle }}
              className={timerClass}
            >
              {timerDisplay}
            </h1>
          </div>
          <div className="w-1/2 h-200 flex flex-col items-center mt-32">
            {!quizStarted && (
              <div className="w-full h-full flex items-center flex-col justify-center gap-2">

                <h1 className="text-white text-6xl pb-8 text-center">How to play?</h1>
                <p className="text-white text-3xl text-center">
                  You have <span className="text-yellow-400">60 seconds</span>
                </p>
                <p className="text-white text-3xl  text-center">
                  Answer <span className="text-green-400">6 questions correctly</span> to defuse the bomb
                </p>
                <p className="text-white text-3xl pb-8 text-center">
                  For each <span className="text-red-500">incorrect</span> answer, <span className="text-red-500">5 seconds will be removed</span> from the timer
                </p>
                <button
                  className="bg-white/30 hover:bg-white/70 text-white px-4 py-2 rounded-md cursor-pointer text-3xl"
                  onClick={handleStart}
                  disabled={running || timeLeft === 0 || quizStarted}
                  style={running || timeLeft === 0 || quizStarted ? { opacity: 0.5, cursor: "not-allowed" } : {}}
                >
                  START
                </button>
              </div>
            )}
            <div className="flex w-128 h-128 flex-col items-center justify-center">
              {!quizStarted ? (
                questions.length === 0 ? (
                  <h1 className="text-white text-4xl p-8 text-center">Loading...</h1>
                ) : null
              ) : questions.length === 0 ? (
                <h1 className="text-white text-4xl p-8 text-center">Loading...</h1>
              ) : quizDone ? (
                finishedBeforeTime ? (
                  <>
                    <h1 className="text-white text-7xl w-160 p-8 text-center">
                      Congratulations!<br />
                      You defused the bomb in time!
                    </h1>
                    <h2 className="text-white text-4xl p-2 text-center flex items-center">
                      Time remaining:{" "}
                      <span
                        style={{
                          ...digitalFontStyle,
                          textShadow: timerTextShadowGreen,
                        }}
                        className="text-6xl text-green-400 ml-4 timer-green-shadow"
                      >
                        {formatTime(defuseTime !== null ? defuseTime : timeLeft)}
                      </span>
                    </h2>
                    <button
                      className="bg-white/30 hover:bg-white/70 text-white px-4 py-2 rounded-md cursor-pointer text-3xl mx-auto mt-4"
                      onClick={handleRetry}
                    >
                      Try Again
                    </button>
                  </>
                ) : (
                  <>
                    <h1 className=" text-8xl p-8 text-center text-white">Unlucky!</h1>
                    <h2 className="text-white text-4xl p-2 text-center flex items-center">
                      You <span className="text-red-500">&nbsp;failed&nbsp;</span> to defuse the bomb in time.
                    </h2>
                    <button
                      className="bg-white/30 hover:bg-white/70 text-white px-4 py-2 rounded-md cursor-pointer text-3xl mx-auto mt-4"
                      onClick={handleRetry}
                    >
                      Try Again
                    </button>
                  </>
                )
              ) : (
                <>
                  <h1 className="text-white text-5xl p-8 text-center h-48">
                    {questions[current].question}
                  </h1>
                  <div className="flex flex-col gap-1.5 w-full">
                    {questions[current].options.map((opt, idx) => {
                      let btnClass =
                        "hover:bg-white/70 bg-white/30 text-white px-4 py-2 rounded-md cursor-pointer text-4xl transition-colors";
                      if (selected !== null) {
                        if (idx === selected) {
                          btnClass +=
                            opt === questions[current].answer
                              ? " !bg-green-500 !text-white"
                              : " !bg-red-500 !text-white";
                        } else if (
                          opt === questions[current].answer &&
                          answerStatus === "wrong"
                        ) {
                          btnClass += " !bg-green-500 !text-white";
                        }
                      }
                      return (
                        <button
                          key={opt}
                          className={btnClass}
                          disabled={selected !== null}
                          onClick={() => handleOptionClick(idx)}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-6 text-white text-2xl text-center">
                    Correct answers: <span className="text-green-400">{correctCount}</span> / 6
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}