import { isTextUIPart, type UIMessage } from "ai";
import { Streamdown } from "streamdown";

export function UserMessage({ parts }: { parts: UIMessage["parts"] }) {
  return (
    <div className="chat__user-message">
      {parts
        .filter(isTextUIPart)
        .map((p) => p.text)
        .join("")}
    </div>
  );
}

export function AssistantMessage({ parts }: { parts: UIMessage["parts"] }) {
  return (
    <div className="chat__assistant-message">
      {parts.map((part, i) =>
        isTextUIPart(part) ? <Streamdown key={i}>{part.text}</Streamdown> : null
      )}
    </div>
  );
}
