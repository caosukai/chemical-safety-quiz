import { HashRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import PracticeSequential from './pages/PracticeSequential';
import PracticeRandom from './pages/PracticeRandom';
import PracticeSingle from './pages/PracticeSingle';
import PracticeJudge from './pages/PracticeJudge';
import Exam from './pages/Exam';
import ExamResult from './pages/ExamResult';
import WrongQuestions from './pages/WrongQuestions';
import Settings from './pages/Settings';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/practice/sequential" element={<PracticeSequential />} />
        <Route path="/practice/random" element={<PracticeRandom />} />
        <Route path="/practice/single" element={<PracticeSingle />} />
        <Route path="/practice/judge" element={<PracticeJudge />} />
        <Route path="/exam" element={<Exam />} />
        <Route path="/exam-result" element={<ExamResult />} />
        <Route path="/wrong-questions" element={<WrongQuestions />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </HashRouter>
  );
}
