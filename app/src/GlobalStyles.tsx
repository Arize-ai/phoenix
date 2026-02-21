import { css, Global } from "@emotion/react";

import type { ThemeContextType } from "./contexts";
import { useTheme } from "./contexts";

/**
 * Medium size root CSS variables
 */
export const mediumRootCSS = css`
  :root,
  .ac-theme {
    --global-dimension-scale-factor: 1;
    --global-dimension-size-0: 0px;
    --global-dimension-size-10: 1px;
    --global-dimension-size-25: 2px;
    --global-dimension-size-30: 2px;
    --global-dimension-size-40: 3px;
    --global-dimension-size-50: 4px;
    --global-dimension-size-65: 5px;
    --global-dimension-size-75: 6px;
    --global-dimension-size-85: 7px;
    --global-dimension-size-100: 8px;
    --global-dimension-size-115: 9px;
    --global-dimension-size-125: 10px;
    --global-dimension-size-130: 11px;
    --global-dimension-size-150: 12px;
    --global-dimension-size-160: 13px;
    --global-dimension-size-175: 14px;
    --global-dimension-size-185: 15px;
    --global-dimension-size-200: 16px;
    --global-dimension-size-225: 18px;
    --global-dimension-size-250: 20px;
    --global-dimension-size-275: 22px;
    --global-dimension-size-300: 24px;
    --global-dimension-size-325: 26px;
    --global-dimension-size-350: 28px;
    --global-dimension-size-400: 32px;
    --global-dimension-size-450: 36px;
    --global-dimension-size-500: 40px;
    --global-dimension-size-550: 44px;
    --global-dimension-size-600: 48px;
    --global-dimension-size-650: 52px;
    --global-dimension-size-675: 54px;
    --global-dimension-size-700: 56px;
    --global-dimension-size-750: 60px;
    --global-dimension-size-800: 64px;
    --global-dimension-size-900: 72px;
    --global-dimension-size-1000: 80px;
    --global-dimension-size-1125: 90px;
    --global-dimension-size-1200: 96px;
    --global-dimension-size-1250: 100px;
    --global-dimension-size-1600: 128px;
    --global-dimension-size-1700: 136px;
    --global-dimension-size-1800: 144px;
    --global-dimension-size-2000: 160px;
    --global-dimension-size-2400: 192px;
    --global-dimension-size-2500: 200px;
    --global-dimension-size-3000: 240px;
    --global-dimension-size-3400: 272px;
    --global-dimension-size-3600: 288px;
    --global-dimension-size-4600: 368px;
    --global-dimension-size-5000: 400px;
    --global-dimension-size-6000: 480px;
  }
`;

const staticCSS = css`
  :root,
  .ac-theme {
    // static colors
    --global-static-color-white-900: rgba(255, 255, 255, 0.9);
    --global-static-color-white-700: rgba(255, 255, 255, 0.7);
    --global-static-color-white-300: rgba(255, 255, 255, 0.3);
    --global-static-color-black-900: rgba(0, 0, 0, 0.9);
    --global-static-color-black-700: rgba(0, 0, 0, 0.7);
    --global-static-color-black-300: rgba(0, 0, 0, 0.3);

    // component sizing
    --global-input-height-s: 30px;
    --global-input-height-m: 38px;
    --global-input-height-l: 46px;
    --global-button-height-s: var(--global-input-height-s);
    --global-button-height-m: var(--global-input-height-m);
    --global-button-height-l: var(--global-input-height-l);
  }
`;

const dimensionsCSS = css`
  :root,
  .ac-theme {
    --global-dimension-static-size-0: 0px;
    --global-dimension-static-size-10: 1px;
    --global-dimension-static-size-25: 2px;
    --global-dimension-static-size-50: 4px;
    --global-dimension-static-size-40: 3px;
    --global-dimension-static-size-65: 5px;
    --global-dimension-static-size-100: 8px;
    --global-dimension-static-size-115: 9px;
    --global-dimension-static-size-125: 10px;
    --global-dimension-static-size-130: 11px;
    --global-dimension-static-size-150: 12px;
    --global-dimension-static-size-160: 13px;
    --global-dimension-static-size-175: 14px;
    --global-dimension-static-size-200: 16px;
    --global-dimension-static-size-225: 18px;
    --global-dimension-static-size-250: 20px;
    --global-dimension-static-size-300: 24px;
    --global-dimension-static-size-400: 32px;
    --global-dimension-static-size-450: 36px;
    --global-dimension-static-size-500: 40px;
    --global-dimension-static-size-550: 44px;
    --global-dimension-static-size-600: 48px;
    --global-dimension-static-size-700: 56px;
    --global-dimension-static-size-800: 64px;
    --global-dimension-static-size-900: 72px;
    --global-dimension-static-size-1000: 80px;
    --global-dimension-static-size-1200: 96px;
    --global-dimension-static-size-1700: 136px;
    --global-dimension-static-size-2400: 192px;
    --global-dimension-static-size-2600: 208px;
    --global-dimension-static-size-3400: 272px;
    --global-dimension-static-size-3600: 288px;
    --global-dimension-static-size-4600: 368px;
    --global-dimension-static-size-5000: 400px;
    --global-dimension-static-size-6000: 480px;
    --global-dimension-static-font-size-50: 11px;
    --global-dimension-static-font-size-75: 12px;
    --global-dimension-static-font-size-100: 14px;
    --global-dimension-static-font-size-150: 15px;
    --global-dimension-static-font-size-200: 16px;
    --global-dimension-static-font-size-300: 18px;
    --global-dimension-static-font-size-400: 20px;
    --global-dimension-static-font-size-500: 22px;
    --global-dimension-static-font-size-600: 25px;
    --global-dimension-static-font-size-700: 28px;
    --global-dimension-static-font-size-800: 32px;
    --global-dimension-static-font-size-900: 36px;
    --global-dimension-static-font-size-1000: 40px;
    --global-dimension-static-percent-50: 50%;
    --global-dimension-static-percent-100: 100%;
    --global-dimension-static-breakpoint-xsmall: 304px;
    --global-dimension-static-breakpoint-small: 768px;
    --global-dimension-static-breakpoint-medium: 1280px;
    --global-dimension-static-breakpoint-large: 1768px;
    --global-dimension-static-breakpoint-xlarge: 2160px;
    --global-dimension-static-grid-columns: 12;
    --global-dimension-static-grid-fluid-width: 100%;
    --global-dimension-static-grid-fixed-max-width: 1280px;

    /* Font sizing */
    --global-dimension-font-size-25: 10px;
    --global-dimension-font-size-50: 11px;
    --global-dimension-font-size-75: 12px;
    --global-dimension-font-size-100: 14px;
    --global-dimension-font-size-150: 15px;
    --global-dimension-font-size-200: 16px;
    --global-dimension-font-size-300: 18px;
    --global-dimension-font-size-400: 20px;
    --global-dimension-font-size-500: 22px;
    --global-dimension-font-size-600: 25px;
    --global-dimension-font-size-700: 28px;
    --global-dimension-font-size-800: 32px;
    --global-dimension-font-size-900: 36px;
    --global-dimension-font-size-1000: 40px;
    --global-dimension-font-size-1100: 45px;
    --global-dimension-font-size-1200: 50px;
    --global-dimension-font-size-1300: 60px;
  }
`;

export const darkThemeCSS = css`
  :root,
  .ac-theme--dark {
    /* Colors */

    // sync system elements like the scrollbar with the theme
    color-scheme: dark;

    // The newer grays (gray)
    --global-color-gray-50-rgb: 0, 0, 0;
    --global-color-gray-50: rgb(var(--global-color-gray-50-rgb));
    --global-color-gray-75-rgb: 14, 14, 14;
    --global-color-gray-75: rgb(var(--global-color-gray-75-rgb));
    --global-color-gray-100-rgb: 29, 29, 29;
    --global-color-gray-100: rgb(var(--global-color-gray-100-rgb));
    --global-color-gray-200-rgb: 48, 48, 48;
    --global-color-gray-200: rgb(var(--global-color-gray-200-rgb));
    --global-color-gray-300-rgb: 75, 75, 75;
    --global-color-gray-300: rgb(var(--global-color-gray-300-rgb));
    --global-color-gray-400-rgb: 106, 106, 106;
    --global-color-gray-400: rgb(var(--global-color-gray-400-rgb));
    --global-color-gray-500-rgb: 141, 141, 141;
    --global-color-gray-500: rgb(var(--global-color-gray-500-rgb));
    --global-color-gray-600-rgb: 176, 176, 176;
    --global-color-gray-600: rgb(var(--global-color-gray-600-rgb));
    --global-color-gray-700-rgb: 208, 208, 208;
    --global-color-gray-700: rgb(var(--global-color-gray-700-rgb));
    --global-color-gray-800-rgb: 235, 235, 235;
    --global-color-gray-800: rgb(var(--global-color-gray-800-rgb));
    --global-color-gray-900-rgb: 255, 255, 255;
    --global-color-gray-900: rgb(var(--global-color-gray-900-rgb));

    --global-color-red-100-rgb: 87, 0, 0;
    --global-color-red-100: rgb(var(--global-color-red-100-rgb));
    --global-color-red-200-rgb: 110, 0, 0;
    --global-color-red-200: rgb(var(--global-color-red-200-rgb));
    --global-color-red-300-rgb: 138, 0, 0;
    --global-color-red-300: rgb(var(--global-color-red-300-rgb));
    --global-color-red-400-rgb: 167, 0, 0;
    --global-color-red-400: rgb(var(--global-color-red-400-rgb));
    --global-color-red-500-rgb: 196, 7, 6;
    --global-color-red-500: rgb(var(--global-color-red-500-rgb));
    --global-color-red-600-rgb: 221, 33, 24;
    --global-color-red-600: rgb(var(--global-color-red-600-rgb));
    --global-color-red-700-rgb: 238, 67, 49;
    --global-color-red-700: rgb(var(--global-color-red-700-rgb));
    --global-color-red-800-rgb: 249, 99, 76;
    --global-color-red-800: rgb(var(--global-color-red-800-rgb));
    --global-color-red-900-rgb: 255, 129, 107;
    --global-color-red-900: rgb(var(--global-color-red-900-rgb));
    --global-color-red-1000-rgb: 255, 158, 140;
    --global-color-red-1000: rgb(var(--global-color-red-1000-rgb));
    --global-color-red-1100-rgb: 255, 183, 169;
    --global-color-red-1100: rgb(var(--global-color-red-1100-rgb));
    --global-color-red-1200-rgb: 255, 205, 195;
    --global-color-red-1200: rgb(var(--global-color-red-1200-rgb));
    --global-color-red-1300-rgb: 255, 223, 217;
    --global-color-red-1300: rgb(var(--global-color-red-1300-rgb));
    --global-color-red-1400-rgb: 255, 237, 234;
    --global-color-red-1400: rgb(var(--global-color-red-1400-rgb));
    --global-color-orange-100-rgb: 72, 24, 1;
    --global-color-orange-100: rgb(var(--global-color-orange-100-rgb));
    --global-color-orange-200-rgb: 92, 32, 0;
    --global-color-orange-200: rgb(var(--global-color-orange-200-rgb));
    --global-color-orange-300-rgb: 115, 43, 0;
    --global-color-orange-300: rgb(var(--global-color-orange-300-rgb));
    --global-color-orange-400-rgb: 138, 55, 0;
    --global-color-orange-400: rgb(var(--global-color-orange-400-rgb));
    --global-color-orange-500-rgb: 162, 68, 0;
    --global-color-orange-500: rgb(var(--global-color-orange-500-rgb));
    --global-color-orange-600-rgb: 186, 82, 0;
    --global-color-orange-600: rgb(var(--global-color-orange-600-rgb));
    --global-color-orange-700-rgb: 210, 98, 0;
    --global-color-orange-700: rgb(var(--global-color-orange-700-rgb));
    --global-color-orange-800-rgb: 232, 116, 0;
    --global-color-orange-800: rgb(var(--global-color-orange-800-rgb));
    --global-color-orange-900-rgb: 249, 137, 23;
    --global-color-orange-900: rgb(var(--global-color-orange-900-rgb));
    --global-color-orange-1000-rgb: 255, 162, 59;
    --global-color-orange-1000: rgb(var(--global-color-orange-1000-rgb));
    --global-color-orange-1100-rgb: 255, 188, 102;
    --global-color-orange-1100: rgb(var(--global-color-orange-1100-rgb));
    --global-color-orange-1200-rgb: 253, 210, 145;
    --global-color-orange-1200: rgb(var(--global-color-orange-1200-rgb));
    --global-color-orange-1300-rgb: 255, 226, 181;
    --global-color-orange-1300: rgb(var(--global-color-orange-1300-rgb));
    --global-color-orange-1400-rgb: 255, 239, 213;
    --global-color-orange-1400: rgb(var(--global-color-orange-1400-rgb));
    --global-color-yellow-100-rgb: 53, 36, 0;
    --global-color-yellow-100: rgb(var(--global-color-yellow-100-rgb));
    --global-color-yellow-200-rgb: 68, 47, 0;
    --global-color-yellow-200: rgb(var(--global-color-yellow-200-rgb));
    --global-color-yellow-300-rgb: 86, 62, 0;
    --global-color-yellow-300: rgb(var(--global-color-yellow-300-rgb));
    --global-color-yellow-400-rgb: 103, 77, 0;
    --global-color-yellow-400: rgb(var(--global-color-yellow-400-rgb));
    --global-color-yellow-500-rgb: 122, 92, 0;
    --global-color-yellow-500: rgb(var(--global-color-yellow-500-rgb));
    --global-color-yellow-600-rgb: 141, 108, 0;
    --global-color-yellow-600: rgb(var(--global-color-yellow-600-rgb));
    --global-color-yellow-700-rgb: 161, 126, 0;
    --global-color-yellow-700: rgb(var(--global-color-yellow-700-rgb));
    --global-color-yellow-800-rgb: 180, 144, 0;
    --global-color-yellow-800: rgb(var(--global-color-yellow-800-rgb));
    --global-color-yellow-900-rgb: 199, 162, 0;
    --global-color-yellow-900: rgb(var(--global-color-yellow-900-rgb));
    --global-color-yellow-1000-rgb: 216, 181, 0;
    --global-color-yellow-1000: rgb(var(--global-color-yellow-1000-rgb));
    --global-color-yellow-1100-rgb: 233, 199, 0;
    --global-color-yellow-1100: rgb(var(--global-color-yellow-1100-rgb));
    --global-color-yellow-1200-rgb: 247, 216, 4;
    --global-color-yellow-1200: rgb(var(--global-color-yellow-1200-rgb));
    --global-color-yellow-1300-rgb: 249, 233, 97;
    --global-color-yellow-1300: rgb(var(--global-color-yellow-1300-rgb));
    --global-color-yellow-1400-rgb: 252, 243, 170;
    --global-color-yellow-1400: rgb(var(--global-color-yellow-1400-rgb));
    --global-color-chartreuse-100-rgb: 32, 43, 0;
    --global-color-chartreuse-100: rgb(var(--global-color-chartreuse-100-rgb));
    --global-color-chartreuse-200-rgb: 42, 56, 0;
    --global-color-chartreuse-200: rgb(var(--global-color-chartreuse-200-rgb));
    --global-color-chartreuse-300-rgb: 54, 72, 0;
    --global-color-chartreuse-300: rgb(var(--global-color-chartreuse-300-rgb));
    --global-color-chartreuse-400-rgb: 66, 88, 0;
    --global-color-chartreuse-400: rgb(var(--global-color-chartreuse-400-rgb));
    --global-color-chartreuse-500-rgb: 79, 105, 0;
    --global-color-chartreuse-500: rgb(var(--global-color-chartreuse-500-rgb));
    --global-color-chartreuse-600-rgb: 93, 123, 0;
    --global-color-chartreuse-600: rgb(var(--global-color-chartreuse-600-rgb));
    --global-color-chartreuse-700-rgb: 107, 142, 0;
    --global-color-chartreuse-700: rgb(var(--global-color-chartreuse-700-rgb));
    --global-color-chartreuse-800-rgb: 122, 161, 0;
    --global-color-chartreuse-800: rgb(var(--global-color-chartreuse-800-rgb));
    --global-color-chartreuse-900-rgb: 138, 180, 3;
    --global-color-chartreuse-900: rgb(var(--global-color-chartreuse-900-rgb));
    --global-color-chartreuse-1000-rgb: 154, 198, 11;
    --global-color-chartreuse-1000: rgb(
      var(--global-color-chartreuse-1000-rgb)
    );
    --global-color-chartreuse-1100-rgb: 170, 216, 22;
    --global-color-chartreuse-1100: rgb(
      var(--global-color-chartreuse-1100-rgb)
    );
    --global-color-chartreuse-1200-rgb: 187, 232, 41;
    --global-color-chartreuse-1200: rgb(
      var(--global-color-chartreuse-1200-rgb)
    );
    --global-color-chartreuse-1300-rgb: 205, 246, 72;
    --global-color-chartreuse-1300: rgb(
      var(--global-color-chartreuse-1300-rgb)
    );
    --global-color-chartreuse-1400-rgb: 225, 253, 132;
    --global-color-chartreuse-1400: rgb(
      var(--global-color-chartreuse-1400-rgb)
    );
    --global-color-celery-100-rgb: 0, 47, 7;
    --global-color-celery-100: rgb(var(--global-color-celery-100-rgb));
    --global-color-celery-200-rgb: 0, 61, 9;
    --global-color-celery-200: rgb(var(--global-color-celery-200-rgb));
    --global-color-celery-300-rgb: 0, 77, 12;
    --global-color-celery-300: rgb(var(--global-color-celery-300-rgb));
    --global-color-celery-400-rgb: 0, 95, 15;
    --global-color-celery-400: rgb(var(--global-color-celery-400-rgb));
    --global-color-celery-500-rgb: 0, 113, 15;
    --global-color-celery-500: rgb(var(--global-color-celery-500-rgb));
    --global-color-celery-600-rgb: 0, 132, 15;
    --global-color-celery-600: rgb(var(--global-color-celery-600-rgb));
    --global-color-celery-700-rgb: 0, 151, 20;
    --global-color-celery-700: rgb(var(--global-color-celery-700-rgb));
    --global-color-celery-800-rgb: 13, 171, 37;
    --global-color-celery-800: rgb(var(--global-color-celery-800-rgb));
    --global-color-celery-900-rgb: 45, 191, 58;
    --global-color-celery-900: rgb(var(--global-color-celery-900-rgb));
    --global-color-celery-1000-rgb: 80, 208, 82;
    --global-color-celery-1000: rgb(var(--global-color-celery-1000-rgb));
    --global-color-celery-1100-rgb: 115, 224, 107;
    --global-color-celery-1100: rgb(var(--global-color-celery-1100-rgb));
    --global-color-celery-1200-rgb: 147, 237, 131;
    --global-color-celery-1200: rgb(var(--global-color-celery-1200-rgb));
    --global-color-celery-1300-rgb: 180, 247, 165;
    --global-color-celery-1300: rgb(var(--global-color-celery-1300-rgb));
    --global-color-celery-1400-rgb: 213, 252, 202;
    --global-color-celery-1400: rgb(var(--global-color-celery-1400-rgb));
    --global-color-green-100-rgb: 10, 44, 28;
    --global-color-green-100: rgb(var(--global-color-green-100-rgb));
    --global-color-green-200-rgb: 7, 59, 36;
    --global-color-green-200: rgb(var(--global-color-green-200-rgb));
    --global-color-green-300-rgb: 0, 76, 46;
    --global-color-green-300: rgb(var(--global-color-green-300-rgb));
    --global-color-green-400-rgb: 0, 93, 57;
    --global-color-green-400: rgb(var(--global-color-green-400-rgb));
    --global-color-green-500-rgb: 0, 111, 69;
    --global-color-green-500: rgb(var(--global-color-green-500-rgb));
    --global-color-green-600-rgb: 0, 130, 82;
    --global-color-green-600: rgb(var(--global-color-green-600-rgb));
    --global-color-green-700-rgb: 0, 149, 98;
    --global-color-green-700: rgb(var(--global-color-green-700-rgb));
    --global-color-green-800-rgb: 28, 168, 114;
    --global-color-green-800: rgb(var(--global-color-green-800-rgb));
    --global-color-green-900-rgb: 52, 187, 132;
    --global-color-green-900: rgb(var(--global-color-green-900-rgb));
    --global-color-green-1000-rgb: 75, 205, 149;
    --global-color-green-1000: rgb(var(--global-color-green-1000-rgb));
    --global-color-green-1100-rgb: 103, 222, 168;
    --global-color-green-1100: rgb(var(--global-color-green-1100-rgb));
    --global-color-green-1200-rgb: 137, 236, 188;
    --global-color-green-1200: rgb(var(--global-color-green-1200-rgb));
    --global-color-green-1300-rgb: 177, 244, 209;
    --global-color-green-1300: rgb(var(--global-color-green-1300-rgb));
    --global-color-green-1400-rgb: 214, 249, 228;
    --global-color-green-1400: rgb(var(--global-color-green-1400-rgb));
    --global-color-seafoam-100-rgb: 18, 43, 42;
    --global-color-seafoam-100: rgb(var(--global-color-seafoam-100-rgb));
    --global-color-seafoam-200-rgb: 19, 57, 55;
    --global-color-seafoam-200: rgb(var(--global-color-seafoam-200-rgb));
    --global-color-seafoam-300-rgb: 16, 73, 70;
    --global-color-seafoam-300: rgb(var(--global-color-seafoam-300-rgb));
    --global-color-seafoam-400-rgb: 3, 91, 88;
    --global-color-seafoam-400: rgb(var(--global-color-seafoam-400-rgb));
    --global-color-seafoam-500-rgb: 0, 108, 104;
    --global-color-seafoam-500: rgb(var(--global-color-seafoam-500-rgb));
    --global-color-seafoam-600-rgb: 0, 127, 121;
    --global-color-seafoam-600: rgb(var(--global-color-seafoam-600-rgb));
    --global-color-seafoam-700-rgb: 0, 146, 140;
    --global-color-seafoam-700: rgb(var(--global-color-seafoam-700-rgb));
    --global-color-seafoam-800-rgb: 0, 165, 159;
    --global-color-seafoam-800: rgb(var(--global-color-seafoam-800-rgb));
    --global-color-seafoam-900-rgb: 26, 185, 178;
    --global-color-seafoam-900: rgb(var(--global-color-seafoam-900-rgb));
    --global-color-seafoam-1000-rgb: 66, 202, 195;
    --global-color-seafoam-1000: rgb(var(--global-color-seafoam-1000-rgb));
    --global-color-seafoam-1100-rgb: 102, 218, 211;
    --global-color-seafoam-1100: rgb(var(--global-color-seafoam-1100-rgb));
    --global-color-seafoam-1200-rgb: 139, 232, 225;
    --global-color-seafoam-1200: rgb(var(--global-color-seafoam-1200-rgb));
    --global-color-seafoam-1300-rgb: 179, 242, 237;
    --global-color-seafoam-1300: rgb(var(--global-color-seafoam-1300-rgb));
    --global-color-seafoam-1400-rgb: 215, 248, 244;
    --global-color-seafoam-1400: rgb(var(--global-color-seafoam-1400-rgb));
    --global-color-cyan-100-rgb: 0, 41, 68;
    --global-color-cyan-100: rgb(var(--global-color-cyan-100-rgb));
    --global-color-cyan-200-rgb: 0, 54, 88;
    --global-color-cyan-200: rgb(var(--global-color-cyan-200-rgb));
    --global-color-cyan-300-rgb: 0, 69, 108;
    --global-color-cyan-300: rgb(var(--global-color-cyan-300-rgb));
    --global-color-cyan-400-rgb: 0, 86, 128;
    --global-color-cyan-400: rgb(var(--global-color-cyan-400-rgb));
    --global-color-cyan-500-rgb: 0, 103, 147;
    --global-color-cyan-500: rgb(var(--global-color-cyan-500-rgb));
    --global-color-cyan-600-rgb: 0, 121, 167;
    --global-color-cyan-600: rgb(var(--global-color-cyan-600-rgb));
    --global-color-cyan-700-rgb: 0, 140, 186;
    --global-color-cyan-700: rgb(var(--global-color-cyan-700-rgb));
    --global-color-cyan-800-rgb: 4, 160, 205;
    --global-color-cyan-800: rgb(var(--global-color-cyan-800-rgb));
    --global-color-cyan-900-rgb: 23, 180, 221;
    --global-color-cyan-900: rgb(var(--global-color-cyan-900-rgb));
    --global-color-cyan-1000-rgb: 57, 199, 234;
    --global-color-cyan-1000: rgb(var(--global-color-cyan-1000-rgb));
    --global-color-cyan-1100-rgb: 96, 216, 243;
    --global-color-cyan-1100: rgb(var(--global-color-cyan-1100-rgb));
    --global-color-cyan-1200-rgb: 134, 230, 250;
    --global-color-cyan-1200: rgb(var(--global-color-cyan-1200-rgb));
    --global-color-cyan-1300-rgb: 170, 242, 255;
    --global-color-cyan-1300: rgb(var(--global-color-cyan-1300-rgb));
    --global-color-cyan-1400-rgb: 206, 249, 255;
    --global-color-cyan-1400: rgb(var(--global-color-cyan-1400-rgb));
    --global-color-blue-100-rgb: 0, 38, 81;
    --global-color-blue-100: rgb(var(--global-color-blue-100-rgb));
    --global-color-blue-200-rgb: 0, 50, 106;
    --global-color-blue-200: rgb(var(--global-color-blue-200-rgb));
    --global-color-blue-300-rgb: 0, 64, 135;
    --global-color-blue-300: rgb(var(--global-color-blue-300-rgb));
    --global-color-blue-400-rgb: 0, 78, 166;
    --global-color-blue-400: rgb(var(--global-color-blue-400-rgb));
    --global-color-blue-500-rgb: 0, 92, 200;
    --global-color-blue-500: rgb(var(--global-color-blue-500-rgb));
    --global-color-blue-600-rgb: 6, 108, 231;
    --global-color-blue-600: rgb(var(--global-color-blue-600-rgb));
    --global-color-blue-700-rgb: 29, 128, 245;
    --global-color-blue-700: rgb(var(--global-color-blue-700-rgb));
    --global-color-blue-800-rgb: 64, 150, 243;
    --global-color-blue-800: rgb(var(--global-color-blue-800-rgb));
    --global-color-blue-900-rgb: 94, 170, 247;
    --global-color-blue-900: rgb(var(--global-color-blue-900-rgb));
    --global-color-blue-1000-rgb: 124, 189, 250;
    --global-color-blue-1000: rgb(var(--global-color-blue-1000-rgb));
    --global-color-blue-1100-rgb: 152, 206, 253;
    --global-color-blue-1100: rgb(var(--global-color-blue-1100-rgb));
    --global-color-blue-1200-rgb: 179, 222, 254;
    --global-color-blue-1200: rgb(var(--global-color-blue-1200-rgb));
    --global-color-blue-1300-rgb: 227, 234, 255;
    --global-color-blue-1300: rgb(var(--global-color-blue-1300-rgb));
    --global-color-blue-1400-rgb: 243, 243, 255;
    --global-color-blue-1400: rgb(var(--global-color-blue-1400-rgb));
    --global-color-indigo-100-rgb: 26, 29, 97;
    --global-color-indigo-100: rgb(var(--global-color-indigo-100-rgb));
    --global-color-indigo-200-rgb: 35, 39, 125;
    --global-color-indigo-200: rgb(var(--global-color-indigo-200-rgb));
    --global-color-indigo-300-rgb: 46, 50, 157;
    --global-color-indigo-300: rgb(var(--global-color-indigo-300-rgb));
    --global-color-indigo-400-rgb: 58, 63, 189;
    --global-color-indigo-400: rgb(var(--global-color-indigo-400-rgb));
    --global-color-indigo-500-rgb: 73, 78, 216;
    --global-color-indigo-500: rgb(var(--global-color-indigo-500-rgb));
    --global-color-indigo-600-rgb: 90, 96, 235;
    --global-color-indigo-600: rgb(var(--global-color-indigo-600-rgb));
    --global-color-indigo-700-rgb: 110, 115, 246;
    --global-color-indigo-700: rgb(var(--global-color-indigo-700-rgb));
    --global-color-indigo-800-rgb: 132, 136, 253;
    --global-color-indigo-800: rgb(var(--global-color-indigo-800-rgb));
    --global-color-indigo-900-rgb: 153, 159, 255;
    --global-color-indigo-900: rgb(var(--global-color-indigo-900-rgb));
    --global-color-indigo-1000-rgb: 174, 177, 255;
    --global-color-indigo-1000: rgb(var(--global-color-indigo-1000-rgb));
    --global-color-indigo-1100-rgb: 194, 196, 255;
    --global-color-indigo-1100: rgb(var(--global-color-indigo-1100-rgb));
    --global-color-indigo-1200-rgb: 212, 213, 255;
    --global-color-indigo-1200: rgb(var(--global-color-indigo-1200-rgb));
    --global-color-indigo-1300-rgb: 227, 228, 255;
    --global-color-indigo-1300: rgb(var(--global-color-indigo-1300-rgb));
    --global-color-indigo-1400-rgb: 240, 240, 255;
    --global-color-indigo-1400: rgb(var(--global-color-indigo-1400-rgb));
    --global-color-purple-100-rgb: 50, 16, 104;
    --global-color-purple-100: rgb(var(--global-color-purple-100-rgb));
    --global-color-purple-200-rgb: 67, 13, 140;
    --global-color-purple-200: rgb(var(--global-color-purple-200-rgb));
    --global-color-purple-300-rgb: 86, 16, 173;
    --global-color-purple-300: rgb(var(--global-color-purple-300-rgb));
    --global-color-purple-400-rgb: 106, 29, 200;
    --global-color-purple-400: rgb(var(--global-color-purple-400-rgb));
    --global-color-purple-500-rgb: 126, 49, 222;
    --global-color-purple-500: rgb(var(--global-color-purple-500-rgb));
    --global-color-purple-600-rgb: 145, 70, 236;
    --global-color-purple-600: rgb(var(--global-color-purple-600-rgb));
    --global-color-purple-700-rgb: 162, 94, 246;
    --global-color-purple-700: rgb(var(--global-color-purple-700-rgb));
    --global-color-purple-800-rgb: 178, 119, 250;
    --global-color-purple-800: rgb(var(--global-color-purple-800-rgb));
    --global-color-purple-900-rgb: 192, 143, 252;
    --global-color-purple-900: rgb(var(--global-color-purple-900-rgb));
    --global-color-purple-1000-rgb: 206, 166, 253;
    --global-color-purple-1000: rgb(var(--global-color-purple-1000-rgb));
    --global-color-purple-1100-rgb: 219, 188, 254;
    --global-color-purple-1100: rgb(var(--global-color-purple-1100-rgb));
    --global-color-purple-1200-rgb: 230, 207, 254;
    --global-color-purple-1200: rgb(var(--global-color-purple-1200-rgb));
    --global-color-purple-1300-rgb: 240, 224, 255;
    --global-color-purple-1300: rgb(var(--global-color-purple-1300-rgb));
    --global-color-purple-1400-rgb: 248, 237, 255;
    --global-color-purple-1400: rgb(var(--global-color-purple-1400-rgb));
    --global-color-fuchsia-100-rgb: 70, 14, 68;
    --global-color-fuchsia-100: rgb(var(--global-color-fuchsia-100-rgb));
    --global-color-fuchsia-200-rgb: 93, 9, 92;
    --global-color-fuchsia-200: rgb(var(--global-color-fuchsia-200-rgb));
    --global-color-fuchsia-300-rgb: 120, 0, 120;
    --global-color-fuchsia-300: rgb(var(--global-color-fuchsia-300-rgb));
    --global-color-fuchsia-400-rgb: 146, 0, 147;
    --global-color-fuchsia-400: rgb(var(--global-color-fuchsia-400-rgb));
    --global-color-fuchsia-500-rgb: 169, 19, 170;
    --global-color-fuchsia-500: rgb(var(--global-color-fuchsia-500-rgb));
    --global-color-fuchsia-600-rgb: 191, 43, 191;
    --global-color-fuchsia-600: rgb(var(--global-color-fuchsia-600-rgb));
    --global-color-fuchsia-700-rgb: 211, 65, 213;
    --global-color-fuchsia-700: rgb(var(--global-color-fuchsia-700-rgb));
    --global-color-fuchsia-800-rgb: 228, 91, 229;
    --global-color-fuchsia-800: rgb(var(--global-color-fuchsia-800-rgb));
    --global-color-fuchsia-900-rgb: 239, 120, 238;
    --global-color-fuchsia-900: rgb(var(--global-color-fuchsia-900-rgb));
    --global-color-fuchsia-1000-rgb: 246, 149, 243;
    --global-color-fuchsia-1000: rgb(var(--global-color-fuchsia-1000-rgb));
    --global-color-fuchsia-1100-rgb: 251, 175, 246;
    --global-color-fuchsia-1100: rgb(var(--global-color-fuchsia-1100-rgb));
    --global-color-fuchsia-1200-rgb: 254, 199, 248;
    --global-color-fuchsia-1200: rgb(var(--global-color-fuchsia-1200-rgb));
    --global-color-fuchsia-1300-rgb: 255, 220, 250;
    --global-color-fuchsia-1300: rgb(var(--global-color-fuchsia-1300-rgb));
    --global-color-fuchsia-1400-rgb: 255, 236, 243;
    --global-color-fuchsia-1400: rgb(var(--global-color-fuchsia-1400-rgb));
    --global-color-magenta-100-rgb: 83, 3, 41;
    --global-color-magenta-100: rgb(var(--global-color-magenta-100-rgb));
    --global-color-magenta-200-rgb: 106, 0, 52;
    --global-color-magenta-200: rgb(var(--global-color-magenta-200-rgb));
    --global-color-magenta-300-rgb: 133, 0, 65;
    --global-color-magenta-300: rgb(var(--global-color-magenta-300-rgb));
    --global-color-magenta-400-rgb: 161, 0, 78;
    --global-color-magenta-400: rgb(var(--global-color-magenta-400-rgb));
    --global-color-magenta-500-rgb: 186, 22, 93;
    --global-color-magenta-500: rgb(var(--global-color-magenta-500-rgb));
    --global-color-magenta-600-rgb: 209, 43, 114;
    --global-color-magenta-600: rgb(var(--global-color-magenta-600-rgb));
    --global-color-magenta-700-rgb: 227, 69, 137;
    --global-color-magenta-700: rgb(var(--global-color-magenta-700-rgb));
    --global-color-magenta-800-rgb: 241, 97, 156;
    --global-color-magenta-800: rgb(var(--global-color-magenta-800-rgb));
    --global-color-magenta-900-rgb: 252, 124, 173;
    --global-color-magenta-900: rgb(var(--global-color-magenta-900-rgb));
    --global-color-magenta-1000-rgb: 255, 152, 191;
    --global-color-magenta-1000: rgb(var(--global-color-magenta-1000-rgb));
    --global-color-magenta-1100-rgb: 255, 179, 207;
    --global-color-magenta-1100: rgb(var(--global-color-magenta-1100-rgb));
    --global-color-magenta-1200-rgb: 254, 202, 221;
    --global-color-magenta-1200: rgb(var(--global-color-magenta-1200-rgb));
    --global-color-magenta-1300-rgb: 255, 221, 233;
    --global-color-magenta-1300: rgb(var(--global-color-magenta-1300-rgb));
    --global-color-magenta-1400-rgb: 255, 236, 243;
    --global-color-magenta-1400: rgb(var(--global-color-magenta-1400-rgb));

    // Semantic colors for dark mode
    --global-color-info-rgb: 114, 217, 255;
    --global-color-info: rgb(var(--global-color-info-rgb));
    --global-color-info-900: rgba(var(--global-color-info-rgb), 0.9);
    --global-color-info-700: rgba(var(--global-color-info-rgb), 0.7);
    --global-color-info-500: rgba(var(--global-color-info-rgb), 0.5);
    --global-color-danger-rgb: 248, 81, 73;
    --global-color-danger: rgb(var(--global-color-danger-rgb));
    --global-color-danger-900: rgba(var(--global-color-danger-rgb), 0.9);
    --global-color-danger-700: rgba(var(--global-color-danger-rgb), 0.7);
    --global-color-danger-500: rgba(var(--global-color-danger-rgb), 0.5);
    --global-color-danger-100: rgba(var(--global-color-danger-rgb), 0.1);
    --global-color-success-rgb: 126, 231, 135;
    --global-color-success: rgb(var(--global-color-success-rgb));
    --global-color-success-900: rgba(var(--global-color-success-rgb), 0.9);
    --global-color-success-700: rgba(var(--global-color-success-rgb), 0.7);
    --global-color-success-500: rgba(var(--global-color-success-rgb), 0.5);
    --global-color-success-100: rgba(var(--global-color-success-rgb), 0.1);
    --global-color-warning-rgb: 230, 153, 88;
    --global-color-warning: rgb(var(--global-color-warning-rgb));
    --global-color-warning-900: rgba(var(--global-color-warning-rgb), 0.9);
    --global-color-warning-700: rgba(var(--global-color-warning-rgb), 0.7);
    --global-color-warning-500: rgba(var(--global-color-warning-rgb), 0.5);
    --global-color-severe-rgb: 188, 76, 0;
    --global-color-severe: rgb(var(--global-color-severe-rgb));
    --global-color-severe-900: rgba(var(--global-color-severe-rgb), 0.9);
    --global-color-severe-700: rgba(var(--global-color-severe-rgb), 0.7);
    --global-color-severe-500: rgba(var(--global-color-severe-rgb), 0.5);

    --global-text-color-900: rgba(255, 255, 255, 0.9);
    --global-text-color-700: rgba(255, 255, 255, 0.7);
    --global-text-color-500: rgba(255, 255, 255, 0.5);
    --global-text-color-300: rgba(255, 255, 255, 0.3);

    // Link colors
    --global-link-color: rgb(114, 217, 255);
    --global-link-color-visited: var(--global-color-purple-900);

    // Floating toolbar colors
    --floating-toolbar-background-color: var(--global-color-gray-200);
    --floating-toolbar-border-color: var(--global-color-gray-300);

    // Optimization Direction Colors
    --global-color-optimization-direction-positive: var(--global-color-success);
    --global-color-background-optimization-direction-positive: var(
      --global-color-success-100
    );
    --global-color-optimization-direction-negative: var(--global-color-danger);
    --global-color-background-optimization-direction-negative: var(
      --global-color-danger-100
    );
  }
`;

export const lightThemeCSS = css`
  :root,
  .ac-theme--light {
    /* Colors */

    // sync system elements like the scrollbar with the theme
    color-scheme: light;

    // The newer grays (gray)
    --global-color-gray-50-rgb: 255, 255, 255;
    --global-color-gray-50: rgb(var(--global-color-gray-50-rgb));
    --global-color-gray-75-rgb: 253, 253, 253;
    --global-color-gray-75: rgb(var(--global-color-gray-75-rgb));
    --global-color-gray-100-rgb: 248, 248, 248;
    --global-color-gray-100: rgb(var(--global-color-gray-100-rgb));
    --global-color-gray-200-rgb: 230, 230, 230;
    --global-color-gray-200: rgb(var(--global-color-gray-200-rgb));
    --global-color-gray-300-rgb: 213, 213, 213;
    --global-color-gray-300: rgb(var(--global-color-gray-300-rgb));
    --global-color-gray-400-rgb: 177, 177, 177;
    --global-color-gray-400: rgb(var(--global-color-gray-400-rgb));
    --global-color-gray-500-rgb: 144, 144, 144;
    --global-color-gray-500: rgb(var(--global-color-gray-500-rgb));
    --global-color-gray-600-rgb: 104, 104, 104;
    --global-color-gray-600: rgb(var(--global-color-gray-600-rgb));
    --global-color-gray-700-rgb: 70, 70, 70;
    --global-color-gray-700: rgb(var(--global-color-gray-700-rgb));
    --global-color-gray-800-rgb: 34, 34, 34;
    --global-color-gray-800: rgb(var(--global-color-gray-800-rgb));
    --global-color-gray-900-rgb: 0, 0, 0;
    --global-color-gray-900: rgb(var(--global-color-gray-900-rgb));

    --global-color-red-100: #ffebe7;
    --global-color-red-200: #ffddd6;
    --global-color-red-300: #ffcdc3;
    --global-color-red-400: #ffb7a9;
    --global-color-red-500: #ff9b88;
    --global-color-red-600: #ff7c65;
    --global-color-red-700: #f75c46;
    --global-color-red-800: #ea3829;
    --global-color-red-900: #d31510;
    --global-color-red-1000: #b40000;
    --global-color-red-1100: #930000;
    --global-color-red-1200: #740000;
    --global-color-red-1300: #590000;
    --global-color-red-1400: #430000;
    --global-color-orange-100: #ffeccc;
    --global-color-orange-200: #ffdfad;
    --global-color-orange-300: #fdd291;
    --global-color-orange-400: #ffbb63;
    --global-color-orange-500: #ffa037;
    --global-color-orange-600: #f68511;
    --global-color-orange-700: #e46f00;
    --global-color-orange-800: #cb5d00;
    --global-color-orange-900: #b14c00;
    --global-color-orange-1000: #953d00;
    --global-color-orange-1100: #7a2f00;
    --global-color-orange-1200: #612300;
    --global-color-orange-1300: #491901;
    --global-color-orange-1400: #351201;
    --global-color-yellow-100: #fbf198;
    --global-color-yellow-200: #f8e750;
    --global-color-yellow-300: #f8d904;
    --global-color-yellow-400: #e8c600;
    --global-color-yellow-500: #d7b300;
    --global-color-yellow-600: #c49f00;
    --global-color-yellow-700: #b08c00;
    --global-color-yellow-800: #9b7800;
    --global-color-yellow-900: #856600;
    --global-color-yellow-1000: #705300;
    --global-color-yellow-1100: #5b4300;
    --global-color-yellow-1200: #483300;
    --global-color-yellow-1300: #362500;
    --global-color-yellow-1400: #281a00;
    --global-color-chartreuse-100: #dbfc6e;
    --global-color-chartreuse-200: #cbf443;
    --global-color-chartreuse-300: #bce92a;
    --global-color-chartreuse-400: #aad816;
    --global-color-chartreuse-500: #98c50a;
    --global-color-chartreuse-600: #87b103;
    --global-color-chartreuse-700: #769c00;
    --global-color-chartreuse-800: #678800;
    --global-color-chartreuse-900: #577400;
    --global-color-chartreuse-1000: #486000;
    --global-color-chartreuse-1100: #3a4d00;
    --global-color-chartreuse-1200: #2c3b00;
    --global-color-chartreuse-1300: #212c00;
    --global-color-chartreuse-1400: #181f00;
    --global-color-celery-100: #cdfcbf;
    --global-color-celery-200: #aef69d;
    --global-color-celery-300: #96ee85;
    --global-color-celery-400: #72e06a;
    --global-color-celery-500: #4ecf50;
    --global-color-celery-600: #27bb36;
    --global-color-celery-700: #07a721;
    --global-color-celery-800: #009112;
    --global-color-celery-900: #007c0f;
    --global-color-celery-1000: #00670f;
    --global-color-celery-1100: #00530d;
    --global-color-celery-1200: #00400a;
    --global-color-celery-1300: #003007;
    --global-color-celery-1400: #002205;
    --global-color-green-100: #cef8e0;
    --global-color-green-200: #adf4ce;
    --global-color-green-300: #89ecbc;
    --global-color-green-400: #67dea8;
    --global-color-green-500: #49cc93;
    --global-color-green-600: #2fb880;
    --global-color-green-700: #15a46e;
    --global-color-green-800: #008f5d;
    --global-color-green-900: #007a4d;
    --global-color-green-1000: #00653e;
    --global-color-green-1100: #005132;
    --global-color-green-1200: #053f27;
    --global-color-green-1300: #0a2e1d;
    --global-color-green-1400: #0a2015;
    --global-color-seafoam-100: #cef7f3;
    --global-color-seafoam-200: #aaf1ea;
    --global-color-seafoam-300: #8ce9e2;
    --global-color-seafoam-400: #65dad2;
    --global-color-seafoam-500: #3fc9c1;
    --global-color-seafoam-600: #0fb5ae;
    --global-color-seafoam-700: #00a19a;
    --global-color-seafoam-800: #008c87;
    --global-color-seafoam-900: #007772;
    --global-color-seafoam-1000: #00635f;
    --global-color-seafoam-1100: #0c4f4c;
    --global-color-seafoam-1200: #123c3a;
    --global-color-seafoam-1300: #122c2b;
    --global-color-seafoam-1400: #0f1f1e;
    --global-color-cyan-100: #c5f8ff;
    --global-color-cyan-200: #a4f0ff;
    --global-color-cyan-300: #88e7fa;
    --global-color-cyan-400: #60d8f3;
    --global-color-cyan-500: #33c5e8;
    --global-color-cyan-600: #12b0da;
    --global-color-cyan-700: #019cc8;
    --global-color-cyan-800: #0086b4;
    --global-color-cyan-900: #00719f;
    --global-color-cyan-1000: #005d89;
    --global-color-cyan-1100: #004a73;
    --global-color-cyan-1200: #00395d;
    --global-color-cyan-1300: #002a46;
    --global-color-cyan-1400: #001e33;
    --global-color-blue-100: #e0f2ff;
    --global-color-blue-200: #cae8ff;
    --global-color-blue-300: #b5deff;
    --global-color-blue-400: #96cefd;
    --global-color-blue-500: #78bbfa;
    --global-color-blue-600: #59a7f6;
    --global-color-blue-700: #3892f3;
    --global-color-blue-800: #147af3;
    --global-color-blue-900: #0265dc;
    --global-color-blue-1000: #0054b6;
    --global-color-blue-1100: #004491;
    --global-color-blue-1200: #003571;
    --global-color-blue-1300: #002754;
    --global-color-blue-1400: #001c3c;
    --global-color-indigo-100: #edeeff;
    --global-color-indigo-200: #e0e2ff;
    --global-color-indigo-300: #d3d5ff;
    --global-color-indigo-400: #c1c4ff;
    --global-color-indigo-500: #acafff;
    --global-color-indigo-600: #9599ff;
    --global-color-indigo-700: #7e84fc;
    --global-color-indigo-800: #686df4;
    --global-color-indigo-900: #5258e4;
    --global-color-indigo-1000: #4046ca;
    --global-color-indigo-1100: #3236a8;
    --global-color-indigo-1200: #262986;
    --global-color-indigo-1300: #1b1e64;
    --global-color-indigo-1400: #141648;
    --global-color-purple-100: #f6ebff;
    --global-color-purple-200: #edf;
    --global-color-purple-300: #e6d0ff;
    --global-color-purple-400: #dbbbfe;
    --global-color-purple-500: #cca4fd;
    --global-color-purple-600: #bd8bfc;
    --global-color-purple-700: #ae72f9;
    --global-color-purple-800: #9d57f4;
    --global-color-purple-900: #893de7;
    --global-color-purple-1000: #7326d3;
    --global-color-purple-1100: #5d13b7;
    --global-color-purple-1200: #470c94;
    --global-color-purple-1300: #33106a;
    --global-color-purple-1400: #230f49;
    --global-color-fuchsia-100: #ffe9fc;
    --global-color-fuchsia-200: #ffdafa;
    --global-color-fuchsia-300: #fec7f8;
    --global-color-fuchsia-400: #fbaef6;
    --global-color-fuchsia-500: #f592f3;
    --global-color-fuchsia-600: #ed74ed;
    --global-color-fuchsia-700: #e055e2;
    --global-color-fuchsia-800: #cd3ace;
    --global-color-fuchsia-900: #b622b7;
    --global-color-fuchsia-1000: #9d039e;
    --global-color-fuchsia-1100: #800081;
    --global-color-fuchsia-1200: #640664;
    --global-color-fuchsia-1300: #470e46;
    --global-color-fuchsia-1400: #320d31;
    --global-color-magenta-100: #ffeaf1;
    --global-color-magenta-200: #ffdce8;
    --global-color-magenta-300: #ffcadd;
    --global-color-magenta-400: #ffb2ce;
    --global-color-magenta-500: #ff95bd;
    --global-color-magenta-600: #fa77aa;
    --global-color-magenta-700: #ef5a98;
    --global-color-magenta-800: #de3d82;
    --global-color-magenta-900: #c82269;
    --global-color-magenta-1000: #ad0955;
    --global-color-magenta-1100: #8e0045;
    --global-color-magenta-1200: #700037;
    --global-color-magenta-1300: #54032a;
    --global-color-magenta-1400: #3c061d;

    // Semantic colors for light mode
    --global-color-info: rgb(2, 173, 221);
    --global-color-info-900: rgba(2, 173, 221, 0.9);
    --global-color-info-700: rgba(2, 173, 221, 0.7);
    --global-color-info-500: rgba(2, 173, 221, 0.5);
    --global-color-danger: rgb(218, 11, 0);
    --global-color-danger-900: rgba(218, 11, 0, 0.9);
    --global-color-danger-700: rgba(218, 11, 0, 0.7);
    --global-color-danger-500: rgba(218, 11, 0, 0.5);
    --global-color-danger-100: rgba(218, 11, 0, 0.1);
    --global-color-success: rgb(26, 127, 55);
    --global-color-success-700: rgba(26, 127, 55, 0.7);
    --global-color-success-500: rgba(26, 127, 55, 0.5);
    --global-color-success-100: rgba(26, 127, 55, 0.1);
    --global-color-warning: rgb(224, 102, 2);
    --global-color-warning-900: rgba(224, 102, 2, 0.9);
    --global-color-warning-700: rgba(224, 102, 2, 0.7);
    --global-color-warning-500: rgba(224, 102, 2, 0.5);
    --global-color-severe: rgb(188, 76, 0);
    --global-color-severe-900: rgba(188, 76, 0, 0.9);
    --global-color-severe-700: rgba(188, 76, 0, 0.7);
    --global-color-severe-500: rgba(188, 76, 0, 0.5);

    --global-text-color-900: rgba(0, 0, 0, 0.9);
    --global-text-color-700: rgba(0, 0, 0, 0.7);
    --global-text-color-500: rgba(0, 0, 0, 0.5);
    --global-text-color-300: rgba(0, 0, 0, 0.3);

    --global-link-color: rgb(9, 105, 218);
    --global-link-color-visited: var(--global-color-purple-900);

    // Floating toolbar colors
    --floating-toolbar-background-color: var(--global-color-gray-75);
    --floating-toolbar-border-color: var(--global-color-gray-200);

    // Optimization Direction Colors
    --global-color-optimization-direction-positive: var(--global-color-success);
    --global-color-background-optimization-direction-positive: var(
      --global-color-success-100
    );
    --global-color-optimization-direction-negative: var(--global-color-danger);
    --global-color-background-optimization-direction-negative: var(
      --global-color-danger-100
    );
  }
`;

export const derivedCSS = (theme: ThemeContextType["theme"]) => css`
  :root,
  .ac-theme--${theme} {
    // The primary color tint for  the apps
    --global-color-primary: var(--global-color-gray-900);
    --global-color-primary-900: rgba(var(--global-color-gray-900-rgb), 0.9);
    --global-color-primary-800: rgba(var(--global-color-gray-900-rgb), 0.8);
    --global-color-primary-700: rgba(var(--global-color-gray-900-rgb), 0.7);
    --global-color-primary-600: rgba(var(--global-color-gray-900-rgb), 0.6);
    --global-color-primary-500: rgba(var(--global-color-gray-900-rgb), 0.5);
    --global-color-primary-400: rgba(var(--global-color-gray-900-rgb), 0.4);
    --global-color-primary-300: rgba(var(--global-color-gray-900-rgb), 0.3);
    --global-color-primary-200: rgba(var(--global-color-gray-900-rgb), 0.2);
    --global-color-primary-100: rgba(var(--global-color-gray-900-rgb), 0.1);
    --global-color-primary-50: rgba(var(--global-color-gray-900-rgb), 0.05);

    --global-background-color-default: var(--global-color-gray-100);
    --global-background-color-light: var(--global-color-gray-200);
    --global-background-color-light-hover: var(--global-color-gray-300);
    --global-background-color-dark: var(--global-color-gray-100);
    --global-background-color-danger: var(--global-color-danger);

    --global-border-color-default: var(--global-color-gray-300);
    --global-border-color-light: var(--global-color-gray-400);
    --global-border-color-dark: var(--global-color-gray-300);

    --highlight-foreground: var(--global-text-color-900);
    --highlight-background: var(--global-color-primary-100);
    --hover-background: var(--global-color-gray-200);
    --focus-ring-color: var(--global-color-primary-500);

    // Text
    --text-color-placeholder: var(--global-color-gray-400);

    // Styles for text fields etc
    --global-input-field-border-color: var(--global-color-gray-400);
    --global-input-field-border-color-hover: var(--global-color-gray-300);
    --global-input-field-border-color-active: var(--global-color-primary);
    --global-input-field-background-color: var(--global-color-gray-100);
    --global-input-field-background-color-hover: var(--global-color-gray-300);
    --global-input-field-background-color-active: var(--global-color-gray-300);

    // Styles for menus
    --global-menu-border-color: var(--global-color-gray-100);
    --global-menu-background-color: var(--global-color-gray-50);
    --global-menu-item-background-color-hover: var(--hover-background);
    --global-menu-split-item-content-gap: var(
      --global-dimension-static-size-300
    );
    --global-menu-item-gap: var(--global-dimension-static-size-50);

    // Styles for buttons
    --global-button-primary-background-color: var(--global-color-gray-900);
    --global-button-primary-foreground-color: var(--global-color-gray-100);
    --global-button-primary-background-color-hover: var(
      --global-color-gray-800
    );
    --global-button-primary-border-color: var(--global-color-gray-900);
    --global-button-danger-background-color: var(--global-color-danger-700);
    --global-button-danger-background-color-hover: var(
      --global-color-danger-900
    );
    --global-button-danger-border-color: var(--global-color-danger);
    --global-button-success-background-color: var(--global-color-success-700);
    --global-button-success-background-color-hover: var(
      --global-color-success-900
    );
    --global-button-success-border-color: var(--global-color-success);

    // Styles for checkbox
    --global-checkbox-selected-color: var(--global-color-gray-800);
    --global-checkbox-selected-color-pressed: var(--global-color-gray-900);
    --global-checkbox-checkmark-color: var(--global-color-gray-50);
    --global-checkbox-border-color: var(--global-color-gray-300);
    --global-checkbox-border-color-pressed: var(--global-color-gray-400);
    --global-checkbox-border-color-hover: var(--global-color-gray-400);

    // Styles for disclosure
    --global-disclosure-background-color-active: rgba(
      var(--global-color-gray-900-rgb),
      0.05
    );

    // Style for tooltips
    --global-tooltip-background-color: var(--global-color-gray-50);
    --global-tooltip-border-color: var(--global-color-gray-300);

    // Style for cards
    --global-card-header-height: 46px;

    // Style for popovers
    --global-popover-border-color: var(--global-color-gray-300);
    --global-popover-background-color: var(--global-color-gray-50);

    --global-rounding-xsmall: var(--global-dimension-static-size-25);
    --global-rounding-small: var(--global-dimension-static-size-50);
    --global-rounding-medium: var(--global-dimension-static-size-100);
    --global-rounding-large: var(--global-dimension-static-size-200);

    --global-border-size-thin: var(--global-dimension-static-size-10);
    --global-border-size-thick: var(--global-dimension-static-size-25);
    --global-border-size-thicker: var(--global-dimension-static-size-50);
    --global-border-size-thickest: var(--global-dimension-static-size-100);
    --global-border-offset-thin: var(--global-dimension-static-size-25);
    --global-border-offset-thick: var(--global-dimension-static-size-50);
    --global-border-offset-thicker: var(--global-dimension-static-size-100);
    --global-border-offset-thickest: var(--global-dimension-static-size-200);
    --global-grid-baseline: var(--global-dimension-static-size-100);
    --global-grid-gutter-xsmall: var(--global-dimension-static-size-200);
    --global-grid-gutter-small: var(--global-dimension-static-size-300);
    --global-grid-gutter-medium: var(--global-dimension-static-size-400);
    --global-grid-gutter-large: var(--global-dimension-static-size-500);
    --global-grid-gutter-xlarge: var(--global-dimension-static-size-600);
    --global-grid-margin-xsmall: var(--global-dimension-static-size-200);
    --global-grid-margin-small: var(--global-dimension-static-size-300);
    --global-grid-margin-medium: var(--global-dimension-static-size-400);
    --global-grid-margin-large: var(--global-dimension-static-size-500);
    --global-grid-margin-xlarge: var(--global-dimension-static-size-600);

    /* Aliases */
    --alias-single-line-height: var(--global-dimension-size-400);
    --alias-single-line-width: var(--global-dimension-size-2400);
  }
`;

const appGlobalStylesCSS = css`
  body,
  input,
  button,
  .ac-theme // We scope it to the theme so we can mount two at the same time
  {
    font-family: "Geist", sans-serif;
    font-optical-sizing: auto;
    font-weight: 400;
    font-style: normal;
    color: var(--global-text-color-900);
  }
  .ac-theme {
    color: var(--global-text-color-900);
    font-size: var(--global-font-size-s);
  }
  body {
    background-color: var(--global-color-gray-75);

    margin: 0;
    overflow: hidden;
    #root,
    #root > div[data-overlay-container="true"],
    #root > div[data-overlay-container="true"] > .ac-theme {
      height: 100vh;
    }
  }

  /* Remove list styling */
  ul {
    display: block;
    list-style-type: none;
    margin-block-start: none;
    margin-block-end: 0;
    padding-inline-start: 0;
    margin-block-start: 0;
  }

  /* A reset style for buttons */
  .button--reset {
    background: none;
    border: none;
    padding: 0;
  }
  /* this css class is added to html via modernizr @see modernizr.js */
  .no-hiddenscroll {
    /* Works on Firefox */
    * {
      scrollbar-width: thin;
      scrollbar-color: var(--global-color-gray-300) var(--global-color-gray-400);
    }

    /* Works on Chrome, Edge, and Safari */
    *::-webkit-scrollbar {
      width: 14px;
    }

    *::-webkit-scrollbar-track {
      background: var(--global-color-gray-100);
    }

    *::-webkit-scrollbar-thumb {
      background-color: var(--global-color-gray-75);
      border-radius: 8px;
      border: 1px solid var(--global-color-gray-300);
    }
  }

  :root,
  .ac-theme {
    --section-background-color: #2f353d;

    /** The color of shadows on menus etc. */
    --overlay-shadow-color: rgba(0, 0, 0, 0.1);
    --overlay-box-shadow: 0px 8px 16px var(--overlay-shadow-color);

    /* An item is a typically something in a list */
    --item-background-color: #1d2126;
    --item-border-color: #282e35;

    --font-weight-heavy: 600;

    --gradient-bar-height: 8px;

    --nav-collapsed-width: 52px;
    --nav-expanded-width: 260px;

    --global-opacity-disabled: 0.4;

    /* Text */
    --global-font-size-xxs: 10px;
    --global-font-size-xs: 12px;
    --global-font-size-s: 14px;
    --global-font-size-m: 16px;
    --global-font-size-l: 18px;
    --global-font-size-xl: 24px;
    --global-font-size-xxl: 32px;

    --global-line-height-xxs: 12px;
    --global-line-height-xs: 16px;
    --global-line-height-s: 20px;
    --global-line-height-m: 24px;
    --global-line-height-l: 28px;
    --global-line-height-xl: 36px;
    --global-line-height-xxl: 48px;

    /* Fields */
    --global-input-field-min-width: 100px;

    /* Modal */
    --global-modal-width-S: 500px;
    --global-modal-width-M: 750px;
    --global-modal-width-L: 1000px;
    --global-modal-width-FULLSCREEN: calc(
      100vw - var(--global-dimension-static-size-1700)
    );
  }

  .ac-theme--dark {
    --primary-color: #9efcfd;
    --primary-color--transparent: rgb(158, 252, 253, 0.2);
    --reference-color: #baa1f9;
    --reference-color--transparent: #baa1f982;
    --corpus-color: #92969c;
    --corpus-color--transparent: #92969c63;
    --overlay-shadow-color: rgba(0, 0, 0, 0.6);
  }
  .ac-theme--light {
    --primary-color: #00add0;
    --primary-color--transparent: rgba(0, 173, 208, 0.2);
    --reference-color: #4500d9;
    --reference-color--transparent: rgba(69, 0, 217, 0.2);
    --corpus-color: #92969c;
    --corpus-color--transparent: #92969c63;
    --overlay-shadow-color: rgba(0, 0, 0, 0.1);
  }
`;

const codeMirrorOverridesCSS = css`
  .ac-theme--light {
    .cm-editor {
      background-color: rgba(255, 255, 255, 0.5) !important;
    }
    .cm-gutters {
      background-color: rgba(0, 0, 0, 0.05) !important;
    }
  }
  .ac-theme--dark {
    .cm-editor {
      background-color: rgba(0, 0, 0, 0.4) !important;
    }
    .cm-gutters {
      background-color: rgba(0, 0, 0, 0.2) !important;
    }
  }
`;

const chartCSS = css`
  .ac-theme {
    --chart-cartesian-grid-stroke-color: var(--global-color-gray-300);
    --chart-axis-stroke-color: var(--global-color-gray-300);
    --chart-axis-text-color: var(--global-text-color-700);
    --chart-axis-label-color: var(--global-text-color-700);
    --chart-legend-text-color: var(--global-text-color-900);
  }
  .ac-theme--dark {
    --chart-tooltip-cursor-fill-color: rgba(255, 255, 255, 0.2);
  }
  .ac-theme--light {
    --chart-tooltip-cursor-fill-color: rgba(0, 0, 0, 0.05);
  }
`;

const fontFamilyCSS = css`
  .font-default {
    font-family: "Geist", sans-serif;
    font-optical-sizing: auto;
  }
  .font-mono,
  pre {
    font-family: "Geist Mono", monospace;
    font-optical-sizing: auto;
  }
`;

export function GlobalStyles() {
  const { theme } = useTheme();
  const themeCSS = theme === "dark" ? darkThemeCSS : lightThemeCSS;
  return (
    <Global
      styles={css(
        dimensionsCSS,
        staticCSS,
        themeCSS,
        derivedCSS(theme),
        mediumRootCSS,
        appGlobalStylesCSS,
        codeMirrorOverridesCSS,
        chartCSS,
        fontFamilyCSS
      )}
    />
  );
}
