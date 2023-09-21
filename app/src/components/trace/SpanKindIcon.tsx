import React from "react";
import { css } from "@emotion/react";

const ToolSVG = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="0.5"
      y="0.5"
      width="19"
      height="19"
      rx="3.5"
      stroke="currentColor"
      strokeOpacity="0.9"
    />
    <mask id="path-2-inside-1_33_16916" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M13 8C13 8.64491 12.8779 9.2613 12.6556 9.82732L17.1924 14.3641L14.364 17.1926L9.82706 12.6557C9.26111 12.8779 8.64481 13 8 13C5.23858 13 3 10.7614 3 8C3 7.13361 3.22036 6.31869 3.60809 5.60822L6 8L7.5 7.50016L8 6.00016L5.60803 3.60819C6.31854 3.2204 7.13353 3 8 3C10.7614 3 13 5.23858 13 8Z"
      />
    </mask>
    <path
      d="M12.6556 9.82732L11.7248 9.46171L11.4853 10.0713L11.9485 10.5344L12.6556 9.82732ZM17.1924 14.3641L17.8995 15.0713L18.6066 14.3641L17.8995 13.657L17.1924 14.3641ZM14.364 17.1926L13.6569 17.8997L14.364 18.6068L15.0711 17.8997L14.364 17.1926ZM9.82706 12.6557L10.5342 11.9486L10.0711 11.4855L9.4615 11.7249L9.82706 12.6557ZM3.60809 5.60822L4.31518 4.90109L3.37037 3.95634L2.7303 5.12917L3.60809 5.60822ZM6 8L5.29291 8.70713L5.72988 9.14407L6.31613 8.94871L6 8ZM7.5 7.50016L7.81614 8.44888L8.29055 8.29079L8.44869 7.81639L7.5 7.50016ZM8 6.00016L8.94869 6.31639L9.14413 5.73007L8.70711 5.29306L8 6.00016ZM5.60803 3.60819L5.12895 2.73042L3.95616 3.37053L4.90093 4.3153L5.60803 3.60819ZM13.5863 10.1929C13.8537 9.51235 14 8.77206 14 8H12C12 8.51776 11.9021 9.01026 11.7248 9.46171L13.5863 10.1929ZM17.8995 13.657L13.3627 9.12022L11.9485 10.5344L16.4853 15.0713L17.8995 13.657ZM15.0711 17.8997L17.8995 15.0713L16.4853 13.657L13.6569 16.4855L15.0711 17.8997ZM9.11995 13.3628L13.6569 17.8997L15.0711 16.4855L10.5342 11.9486L9.11995 13.3628ZM8 14C8.77194 14 9.51211 13.8537 10.1926 13.5865L9.4615 11.7249C9.0101 11.9022 8.51768 12 8 12V14ZM2 8C2 11.3137 4.68629 14 8 14V12C5.79086 12 4 10.2091 4 8H2ZM2.7303 5.12917C2.2644 5.98288 2 6.96206 2 8H4C4 7.30516 4.17633 6.65449 4.48588 6.08727L2.7303 5.12917ZM6.70709 7.29287L4.31518 4.90109L2.901 6.31535L5.29291 8.70713L6.70709 7.29287ZM7.18387 6.55145L5.68387 7.05129L6.31613 8.94871L7.81614 8.44888L7.18387 6.55145ZM7.05132 5.68394L6.55132 7.18394L8.44869 7.81639L8.94869 6.31639L7.05132 5.68394ZM4.90093 4.3153L7.2929 6.70727L8.70711 5.29306L6.31514 2.90109L4.90093 4.3153ZM8 2C6.96197 2 5.98271 2.26444 5.12895 2.73042L6.08712 4.48596C6.65437 4.17636 7.3051 4 8 4V2ZM14 8C14 4.68629 11.3137 2 8 2V4C10.2091 4 12 5.79086 12 8H14Z"
      fill="currentColor"
      fillOpacity="0.9"
      mask="url(#path-2-inside-1_33_16916)"
    />
  </svg>
);

const LLMSVG = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="0.5"
      y="0.5"
      width="19"
      height="19"
      rx="3.5"
      stroke="currentColor"
      strokeOpacity="0.9"
    />
    <path
      d="M4.43782 6.78868L10 3.57735L15.5622 6.78868V13.2113L10 16.4226L4.43782 13.2113V6.78868Z"
      stroke="currentColor"
      strokeOpacity="0.9"
    />
  </svg>
);

const AgentSVG = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="0.5"
      y="0.5"
      width="19"
      height="19"
      rx="3.5"
      stroke="currentColor"
      strokeOpacity="0.9"
    />
    <path
      d="M5 16C5 16 5 11 10 11C15 11 15 16 15 16"
      stroke="currentColor"
      strokeOpacity="0.9"
    />
    <rect
      x="6.5"
      y="4.5"
      width="7"
      height="5"
      rx="0.5"
      stroke="currentColor"
      strokeOpacity="0.9"
    />
  </svg>
);

const EmbeddingSVG = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="0.5"
      y="0.5"
      width="19"
      height="19"
      rx="3.5"
      stroke="currentColor"
      strokeOpacity="0.9"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M10 6C10 7.10457 9.10457 8 8 8C6.89543 8 6 7.10457 6 6C6 4.89543 6.89543 4 8 4C9.10457 4 10 4.89543 10 6ZM10.0558 8.18487C9.51887 8.6903 8.7956 9 8 9C7.91155 9 7.824 8.99617 7.7375 8.98867L7.10304 11.2093C8.21409 11.6488 9 12.7326 9 14C9 15.6569 7.65685 17 6 17C4.34315 17 3 15.6569 3 14C3 12.3431 4.34315 11 6 11C6.0409 11 6.08161 11.0008 6.12212 11.0024L6.76944 8.73682C5.72625 8.26703 5 7.21833 5 6C5 4.34315 6.34315 3 8 3C9.65685 3 11 4.34315 11 6C11 6.50075 10.8773 6.97285 10.6604 7.38788L12.1873 8.6094C12.6908 8.22697 13.3189 8 14 8C15.6569 8 17 9.34315 17 11C17 12.6569 15.6569 14 14 14C12.3431 14 11 12.6569 11 11C11 10.3864 11.1842 9.81579 11.5004 9.34053L10.0558 8.18487ZM16 11C16 12.1046 15.1046 13 14 13C12.8954 13 12 12.1046 12 11C12 9.89543 12.8954 9 14 9C15.1046 9 16 9.89543 16 11ZM6 16C7.10457 16 8 15.1046 8 14C8 12.8954 7.10457 12 6 12C4.89543 12 4 12.8954 4 14C4 15.1046 4.89543 16 6 16Z"
      fill="currentColor"
      fillOpacity="0.9"
    />
  </svg>
);

const RetrieverSVG = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="0.5"
      y="0.5"
      width="19"
      height="19"
      rx="3.5"
      stroke="currentColor"
      strokeOpacity="0.9"
    />
    <path
      d="M14.65 6.5C14.65 6.98637 14.2466 7.52091 13.379 7.95472C12.5323 8.37806 11.3382 8.65 10 8.65C8.66184 8.65 7.46767 8.37806 6.62099 7.95472C5.75338 7.52091 5.35 6.98637 5.35 6.5C5.35 6.01363 5.75338 5.47909 6.62099 5.04528C7.46767 4.62194 8.66184 4.35 10 4.35C11.3382 4.35 12.5323 4.62194 13.379 5.04528C14.2466 5.47909 14.65 6.01363 14.65 6.5Z"
      stroke="currentColor"
      strokeOpacity="0.9"
      strokeWidth="0.7"
    />
    <path
      d="M14.6875 6.83482V9.62479C14.6875 9.62479 13.0769 11.1873 10 11.1873C6.92308 11.1873 5.3125 9.62479 5.3125 9.62479V6.7437"
      stroke="currentColor"
      strokeOpacity="0.9"
      strokeWidth="0.7"
    />
    <path
      d="M14.6875 9.625V12.125C14.6875 12.125 13.0769 13.6875 10 13.6875C6.92308 13.6875 5.3125 12.125 5.3125 12.125V9.625"
      stroke="currentColor"
      strokeOpacity="0.9"
      strokeWidth="0.7"
    />
    <path
      d="M14.6875 12.125V14.625C14.6875 14.625 13.0769 16.1875 10 16.1875C6.92308 16.1875 5.3125 14.625 5.3125 14.625V12.125"
      stroke="currentColor"
      strokeOpacity="0.9"
      strokeWidth="0.7"
    />
  </svg>
);

const ChainSVG = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="0.5"
      y="0.5"
      width="19"
      height="19"
      rx="3.5"
      stroke="currentColor"
      strokeOpacity="0.9"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M10 15C12.7614 15 15 12.7614 15 10C15 7.23858 12.7614 5 10 5C7.23858 5 5 7.23858 5 10C5 12.7614 7.23858 15 10 15ZM10 16C13.3137 16 16 13.3137 16 10C16 6.68629 13.3137 4 10 4C6.68629 4 4 6.68629 4 10C4 13.3137 6.68629 16 10 16Z"
      fill="currentColor"
      fillOpacity="0.9"
    />
  </svg>
);

export function SpanKindIcon({ spanKind }: { spanKind: string }) {
  let icon = <></>;
  let color = "gray-100";
  switch (spanKind) {
    case "llm":
      color = "--ac-global-color-orange-1000";
      icon = <LLMSVG />;
      break;
    case "chain":
      color = "--px-light-blue-color";
      icon = <ChainSVG />;
      break;
    case "retriever":
      color = "--ac-global-color-seafoam-1000";
      icon = <RetrieverSVG />;
      break;
    case "embedding":
      color = "--ac-global-color-indigo-1000";
      icon = <EmbeddingSVG />;
      break;
    case "agent":
      color = "--ac-global-color-gray-100";
      icon = <AgentSVG />;
      break;
    case "tool":
      color = "--ac-global-color-yellow-1200";
      icon = <ToolSVG />;
      break;
  }

  return (
    <div
      css={css`
        color: var(${color});
        width: 20px;
        height: 20px;
      `}
    >
      {icon}
    </div>
  );
}
