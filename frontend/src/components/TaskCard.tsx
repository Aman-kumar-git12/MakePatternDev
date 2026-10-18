import React from 'react';
import type { Task, TaskStatus } from '../types/task';
import { Calendar, Trash2, ArrowRight } from 'lucide-react';

interface TaskCardProps {
  task: Task;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
}

const statusOptions: { label: string; value: TaskStatus }[] = [
  { label: 'To Do', value: 'todo' },
  { label: 'In Progress', value: 'in-progress' },
  { label: 'Completed', value: 'completed' },
];

const priorityBadgeColors: Record<Task['priority'], string> = {
  low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  high: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

export const TaskCard: React.FC<TaskCardProps> = ({ task, onStatusChange, onDelete }) => {
  const formattedDate = new Date(task.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="group bg-slate-900/70 border border-slate-800 hover:border-slate-700/90 rounded-xl p-5 shadow-lg transition duration-200 flex flex-col justify-between hover:shadow-indigo-500/5">
      <div>
        <div className="flex items-center justify-between mb-3">
          <span
            className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${
              priorityBadgeColors[task.priority]
            }`}
          >
            {task.priority}
          </span>
          <button
            onClick={() => onDelete(task.id)}
            className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
            title="Delete task"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <h3 className="font-semibold text-lg text-slate-100 mb-2 leading-snug">{task.title}</h3>
        <p className="text-sm text-slate-400 mb-4 line-clamp-3">{task.description || 'No description provided.'}</p>
      </div>

      <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center space-x-1.5">
          <Calendar className="w-3.5 h-3.5" />
          <span>{formattedDate}</span>
        </div>

        <div className="flex items-center space-x-1">
          <label htmlFor={`status-${task.id}`} className="sr-only">Status</label>
          <div className="relative">
            <select
              id={`status-${task.id}`}
              value={task.status}
              onChange={(e) => onStatusChange(task.id, e.target.value as TaskStatus)}
              className="bg-slate-800 text-slate-200 border border-slate-700 rounded-md py-1 px-2 pr-6 appearance-none text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ArrowRight className="w-3 h-3 absolute right-2 top-2 pointer-events-none text-slate-400" />
          </div>
        </div>
      </div>
    </div>
  );
};
