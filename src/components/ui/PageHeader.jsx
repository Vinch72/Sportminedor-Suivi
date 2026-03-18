// src/components/ui/PageHeader.jsx
import logo from "../../assets/sportminedor-logo.png";

export default function PageHeader({ title, description, action }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        <img src={logo} alt="" className="h-9 w-9 rounded-full select-none shrink-0" draggable="false" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">{title}</h1>
          {description && (
            <p className="text-sm text-gray-400 mt-0.5">{description}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}
