import { css, Global } from "@emotion/react";

import { useProvider } from "@arizeai/components";

import { ThemeContextType } from "./contexts";

/**
 * Medium size root CSS variables
 */
export const mediumRootCSS = css`
  :root {
    --ac-global-dimension-scale-factor: 1;
    --ac-global-dimension-size-0: 0px;
    --ac-global-dimension-size-10: 1px;
    --ac-global-dimension-size-25: 2px;
    --ac-global-dimension-size-30: 2px;
    --ac-global-dimension-size-40: 3px;
    --ac-global-dimension-size-50: 4px;
    --ac-global-dimension-size-65: 5px;
    --ac-global-dimension-size-75: 6px;
    --ac-global-dimension-size-85: 7px;
    --ac-global-dimension-size-100: 8px;
    --ac-global-dimension-size-115: 9px;
    --ac-global-dimension-size-125: 10px;
    --ac-global-dimension-size-130: 11px;
    --ac-global-dimension-size-150: 12px;
    --ac-global-dimension-size-160: 13px;
    --ac-global-dimension-size-175: 14px;
    --ac-global-dimension-size-185: 15px;
    --ac-global-dimension-size-200: 16px;
    --ac-global-dimension-size-225: 18px;
    --ac-global-dimension-size-250: 20px;
    --ac-global-dimension-size-275: 22px;
    --ac-global-dimension-size-300: 24px;
    --ac-global-dimension-size-325: 26px;
    --ac-global-dimension-size-350: 28px;
    --ac-global-dimension-size-400: 32px;
    --ac-global-dimension-size-450: 36px;
    --ac-global-dimension-size-500: 40px;
    --ac-global-dimension-size-550: 44px;
    --ac-global-dimension-size-600: 48px;
    --ac-global-dimension-size-650: 52px;
    --ac-global-dimension-size-675: 54px;
    --ac-global-dimension-size-700: 56px;
    --ac-global-dimension-size-750: 60px;
    --ac-global-dimension-size-800: 64px;
    --ac-global-dimension-size-900: 72px;
    --ac-global-dimension-size-1000: 80px;
    --ac-global-dimension-size-1125: 90px;
    --ac-global-dimension-size-1200: 96px;
    --ac-global-dimension-size-1250: 100px;
    --ac-global-dimension-size-1600: 128px;
    --ac-global-dimension-size-1700: 136px;
    --ac-global-dimension-size-1800: 144px;
    --ac-global-dimension-size-2000: 160px;
    --ac-global-dimension-size-2400: 192px;
    --ac-global-dimension-size-2500: 200px;
    --ac-global-dimension-size-3000: 240px;
    --ac-global-dimension-size-3400: 272px;
    --ac-global-dimension-size-3600: 288px;
    --ac-global-dimension-size-4600: 368px;
    --ac-global-dimension-size-5000: 400px;
    --ac-global-dimension-size-6000: 480px;
  }
`;

const staticCSS = css`
  :root {
    // static colors
    --ac-global-static-color-white-900: rgba(255, 255, 255, 0.9);
    --ac-global-static-color-white-700: rgba(255, 255, 255, 0.7);
    --ac-global-static-color-white-300: rgba(255, 255, 255, 0.3);
    --ac-global-static-color-black-900: rgba(0, 0, 0, 0.9);
    --ac-global-static-color-black-700: rgba(0, 0, 0, 0.7);
    --ac-global-static-color-black-300: rgba(0, 0, 0, 0.3);
  }
`;

const dimensionsCSS = css`
  :root {
    --ac-global-dimension-static-size-0: 0px;
    --ac-global-dimension-static-size-10: 1px;
    --ac-global-dimension-static-size-25: 2px;
    --ac-global-dimension-static-size-50: 4px;
    --ac-global-dimension-static-size-40: 3px;
    --ac-global-dimension-static-size-65: 5px;
    --ac-global-dimension-static-size-100: 8px;
    --ac-global-dimension-static-size-115: 9px;
    --ac-global-dimension-static-size-125: 10px;
    --ac-global-dimension-static-size-130: 11px;
    --ac-global-dimension-static-size-150: 12px;
    --ac-global-dimension-static-size-160: 13px;
    --ac-global-dimension-static-size-175: 14px;
    --ac-global-dimension-static-size-200: 16px;
    --ac-global-dimension-static-size-225: 18px;
    --ac-global-dimension-static-size-250: 20px;
    --ac-global-dimension-static-size-300: 24px;
    --ac-global-dimension-static-size-400: 32px;
    --ac-global-dimension-static-size-450: 36px;
    --ac-global-dimension-static-size-500: 40px;
    --ac-global-dimension-static-size-550: 44px;
    --ac-global-dimension-static-size-600: 48px;
    --ac-global-dimension-static-size-700: 56px;
    --ac-global-dimension-static-size-800: 64px;
    --ac-global-dimension-static-size-900: 72px;
    --ac-global-dimension-static-size-1000: 80px;
    --ac-global-dimension-static-size-1200: 96px;
    --ac-global-dimension-static-size-1700: 136px;
    --ac-global-dimension-static-size-2400: 192px;
    --ac-global-dimension-static-size-2600: 208px;
    --ac-global-dimension-static-size-3400: 272px;
    --ac-global-dimension-static-size-3600: 288px;
    --ac-global-dimension-static-size-4600: 368px;
    --ac-global-dimension-static-size-5000: 400px;
    --ac-global-dimension-static-size-6000: 480px;
    --ac-global-dimension-static-font-size-50: 11px;
    --ac-global-dimension-static-font-size-75: 12px;
    --ac-global-dimension-static-font-size-100: 14px;
    --ac-global-dimension-static-font-size-150: 15px;
    --ac-global-dimension-static-font-size-200: 16px;
    --ac-global-dimension-static-font-size-300: 18px;
    --ac-global-dimension-static-font-size-400: 20px;
    --ac-global-dimension-static-font-size-500: 22px;
    --ac-global-dimension-static-font-size-600: 25px;
    --ac-global-dimension-static-font-size-700: 28px;
    --ac-global-dimension-static-font-size-800: 32px;
    --ac-global-dimension-static-font-size-900: 36px;
    --ac-global-dimension-static-font-size-1000: 40px;
    --ac-global-dimension-static-percent-50: 50%;
    --ac-global-dimension-static-percent-100: 100%;
    --ac-global-dimension-static-breakpoint-xsmall: 304px;
    --ac-global-dimension-static-breakpoint-small: 768px;
    --ac-global-dimension-static-breakpoint-medium: 1280px;
    --ac-global-dimension-static-breakpoint-large: 1768px;
    --ac-global-dimension-static-breakpoint-xlarge: 2160px;
    --ac-global-dimension-static-grid-columns: 12;
    --ac-global-dimension-static-grid-fluid-width: 100%;
    --ac-global-dimension-static-grid-fixed-max-width: 1280px;

    /* Font sizing */
    --ac-global-dimension-font-size-25: 10px;
    --ac-global-dimension-font-size-50: 11px;
    --ac-global-dimension-font-size-75: 12px;
    --ac-global-dimension-font-size-100: 14px;
    --ac-global-dimension-font-size-150: 15px;
    --ac-global-dimension-font-size-200: 16px;
    --ac-global-dimension-font-size-300: 18px;
    --ac-global-dimension-font-size-400: 20px;
    --ac-global-dimension-font-size-500: 22px;
    --ac-global-dimension-font-size-600: 25px;
    --ac-global-dimension-font-size-700: 28px;
    --ac-global-dimension-font-size-800: 32px;
    --ac-global-dimension-font-size-900: 36px;
    --ac-global-dimension-font-size-1000: 40px;
    --ac-global-dimension-font-size-1100: 45px;
    --ac-global-dimension-font-size-1200: 50px;
    --ac-global-dimension-font-size-1300: 60px;
  }
`;

export const darkThemeCSS = css`
  :root,
  .ac-theme--dark {
    /* Colors */

    // The newer grays (grey)
    --ac-global-color-grey-50-rgb: 0, 0, 0;
    --ac-global-color-grey-50: rgb(var(--ac-global-color-grey-50-rgb));
    --ac-global-color-grey-75-rgb: 14, 14, 14;
    --ac-global-color-grey-75: rgb(var(--ac-global-color-grey-75-rgb));
    --ac-global-color-grey-100-rgb: 29, 29, 29;
    --ac-global-color-grey-100: rgb(var(--ac-global-color-grey-100-rgb));
    --ac-global-color-grey-200-rgb: 48, 48, 48;
    --ac-global-color-grey-200: rgb(var(--ac-global-color-grey-200-rgb));
    --ac-global-color-grey-300-rgb: 75, 75, 75;
    --ac-global-color-grey-300: rgb(var(--ac-global-color-grey-300-rgb));
    --ac-global-color-grey-400-rgb: 106, 106, 106;
    --ac-global-color-grey-400: rgb(var(--ac-global-color-grey-400-rgb));
    --ac-global-color-grey-500-rgb: 141, 141, 141;
    --ac-global-color-grey-500: rgb(var(--ac-global-color-grey-500-rgb));
    --ac-global-color-grey-600-rgb: 176, 176, 176;
    --ac-global-color-grey-600: rgb(var(--ac-global-color-grey-600-rgb));
    --ac-global-color-grey-700-rgb: 208, 208, 208;
    --ac-global-color-grey-700: rgb(var(--ac-global-color-grey-700-rgb));
    --ac-global-color-grey-800-rgb: 235, 235, 235;
    --ac-global-color-grey-800: rgb(var(--ac-global-color-grey-800-rgb));
    --ac-global-color-grey-900-rgb: 255, 255, 255;
    --ac-global-color-grey-900: rgb(var(--ac-global-color-grey-900-rgb));

    --ac-global-color-red-100-rgb: 87, 0, 0;
    --ac-global-color-red-100: rgb(var(--ac-global-color-red-100-rgb));
    --ac-global-color-red-200-rgb: 110, 0, 0;
    --ac-global-color-red-200: rgb(var(--ac-global-color-red-200-rgb));
    --ac-global-color-red-300-rgb: 138, 0, 0;
    --ac-global-color-red-300: rgb(var(--ac-global-color-red-300-rgb));
    --ac-global-color-red-400-rgb: 167, 0, 0;
    --ac-global-color-red-400: rgb(var(--ac-global-color-red-400-rgb));
    --ac-global-color-red-500-rgb: 196, 7, 6;
    --ac-global-color-red-500: rgb(var(--ac-global-color-red-500-rgb));
    --ac-global-color-red-600-rgb: 221, 33, 24;
    --ac-global-color-red-600: rgb(var(--ac-global-color-red-600-rgb));
    --ac-global-color-red-700-rgb: 238, 67, 49;
    --ac-global-color-red-700: rgb(var(--ac-global-color-red-700-rgb));
    --ac-global-color-red-800-rgb: 249, 99, 76;
    --ac-global-color-red-800: rgb(var(--ac-global-color-red-800-rgb));
    --ac-global-color-red-900-rgb: 255, 129, 107;
    --ac-global-color-red-900: rgb(var(--ac-global-color-red-900-rgb));
    --ac-global-color-red-1000-rgb: 255, 158, 140;
    --ac-global-color-red-1000: rgb(var(--ac-global-color-red-1000-rgb));
    --ac-global-color-red-1100-rgb: 255, 183, 169;
    --ac-global-color-red-1100: rgb(var(--ac-global-color-red-1100-rgb));
    --ac-global-color-red-1200-rgb: 255, 205, 195;
    --ac-global-color-red-1200: rgb(var(--ac-global-color-red-1200-rgb));
    --ac-global-color-red-1300-rgb: 255, 223, 217;
    --ac-global-color-red-1300: rgb(var(--ac-global-color-red-1300-rgb));
    --ac-global-color-red-1400-rgb: 255, 237, 234;
    --ac-global-color-red-1400: rgb(var(--ac-global-color-red-1400-rgb));
    --ac-global-color-orange-100-rgb: 72, 24, 1;
    --ac-global-color-orange-100: rgb(var(--ac-global-color-orange-100-rgb));
    --ac-global-color-orange-200-rgb: 92, 32, 0;
    --ac-global-color-orange-200: rgb(var(--ac-global-color-orange-200-rgb));
    --ac-global-color-orange-300-rgb: 115, 43, 0;
    --ac-global-color-orange-300: rgb(var(--ac-global-color-orange-300-rgb));
    --ac-global-color-orange-400-rgb: 138, 55, 0;
    --ac-global-color-orange-400: rgb(var(--ac-global-color-orange-400-rgb));
    --ac-global-color-orange-500-rgb: 162, 68, 0;
    --ac-global-color-orange-500: rgb(var(--ac-global-color-orange-500-rgb));
    --ac-global-color-orange-600-rgb: 186, 82, 0;
    --ac-global-color-orange-600: rgb(var(--ac-global-color-orange-600-rgb));
    --ac-global-color-orange-700-rgb: 210, 98, 0;
    --ac-global-color-orange-700: rgb(var(--ac-global-color-orange-700-rgb));
    --ac-global-color-orange-800-rgb: 232, 116, 0;
    --ac-global-color-orange-800: rgb(var(--ac-global-color-orange-800-rgb));
    --ac-global-color-orange-900-rgb: 249, 137, 23;
    --ac-global-color-orange-900: rgb(var(--ac-global-color-orange-900-rgb));
    --ac-global-color-orange-1000-rgb: 255, 162, 59;
    --ac-global-color-orange-1000: rgb(var(--ac-global-color-orange-1000-rgb));
    --ac-global-color-orange-1100-rgb: 255, 188, 102;
    --ac-global-color-orange-1100: rgb(var(--ac-global-color-orange-1100-rgb));
    --ac-global-color-orange-1200-rgb: 253, 210, 145;
    --ac-global-color-orange-1200: rgb(var(--ac-global-color-orange-1200-rgb));
    --ac-global-color-orange-1300-rgb: 255, 226, 181;
    --ac-global-color-orange-1300: rgb(var(--ac-global-color-orange-1300-rgb));
    --ac-global-color-orange-1400-rgb: 255, 239, 213;
    --ac-global-color-orange-1400: rgb(var(--ac-global-color-orange-1400-rgb));
    --ac-global-color-yellow-100-rgb: 53, 36, 0;
    --ac-global-color-yellow-100: rgb(var(--ac-global-color-yellow-100-rgb));
    --ac-global-color-yellow-200-rgb: 68, 47, 0;
    --ac-global-color-yellow-200: rgb(var(--ac-global-color-yellow-200-rgb));
    --ac-global-color-yellow-300-rgb: 86, 62, 0;
    --ac-global-color-yellow-300: rgb(var(--ac-global-color-yellow-300-rgb));
    --ac-global-color-yellow-400-rgb: 103, 77, 0;
    --ac-global-color-yellow-400: rgb(var(--ac-global-color-yellow-400-rgb));
    --ac-global-color-yellow-500-rgb: 122, 92, 0;
    --ac-global-color-yellow-500: rgb(var(--ac-global-color-yellow-500-rgb));
    --ac-global-color-yellow-600-rgb: 141, 108, 0;
    --ac-global-color-yellow-600: rgb(var(--ac-global-color-yellow-600-rgb));
    --ac-global-color-yellow-700-rgb: 161, 126, 0;
    --ac-global-color-yellow-700: rgb(var(--ac-global-color-yellow-700-rgb));
    --ac-global-color-yellow-800-rgb: 180, 144, 0;
    --ac-global-color-yellow-800: rgb(var(--ac-global-color-yellow-800-rgb));
    --ac-global-color-yellow-900-rgb: 199, 162, 0;
    --ac-global-color-yellow-900: rgb(var(--ac-global-color-yellow-900-rgb));
    --ac-global-color-yellow-1000-rgb: 216, 181, 0;
    --ac-global-color-yellow-1000: rgb(var(--ac-global-color-yellow-1000-rgb));
    --ac-global-color-yellow-1100-rgb: 233, 199, 0;
    --ac-global-color-yellow-1100: rgb(var(--ac-global-color-yellow-1100-rgb));
    --ac-global-color-yellow-1200-rgb: 247, 216, 4;
    --ac-global-color-yellow-1200: rgb(var(--ac-global-color-yellow-1200-rgb));
    --ac-global-color-yellow-1300-rgb: 249, 233, 97;
    --ac-global-color-yellow-1300: rgb(var(--ac-global-color-yellow-1300-rgb));
    --ac-global-color-yellow-1400-rgb: 252, 243, 170;
    --ac-global-color-yellow-1400: rgb(var(--ac-global-color-yellow-1400-rgb));
    --ac-global-color-chartreuse-100-rgb: 32, 43, 0;
    --ac-global-color-chartreuse-100: rgb(
      var(--ac-global-color-chartreuse-100-rgb)
    );
    --ac-global-color-chartreuse-200-rgb: 42, 56, 0;
    --ac-global-color-chartreuse-200: rgb(
      var(--ac-global-color-chartreuse-200-rgb)
    );
    --ac-global-color-chartreuse-300-rgb: 54, 72, 0;
    --ac-global-color-chartreuse-300: rgb(
      var(--ac-global-color-chartreuse-300-rgb)
    );
    --ac-global-color-chartreuse-400-rgb: 66, 88, 0;
    --ac-global-color-chartreuse-400: rgb(
      var(--ac-global-color-chartreuse-400-rgb)
    );
    --ac-global-color-chartreuse-500-rgb: 79, 105, 0;
    --ac-global-color-chartreuse-500: rgb(
      var(--ac-global-color-chartreuse-500-rgb)
    );
    --ac-global-color-chartreuse-600-rgb: 93, 123, 0;
    --ac-global-color-chartreuse-600: rgb(
      var(--ac-global-color-chartreuse-600-rgb)
    );
    --ac-global-color-chartreuse-700-rgb: 107, 142, 0;
    --ac-global-color-chartreuse-700: rgb(
      var(--ac-global-color-chartreuse-700-rgb)
    );
    --ac-global-color-chartreuse-800-rgb: 122, 161, 0;
    --ac-global-color-chartreuse-800: rgb(
      var(--ac-global-color-chartreuse-800-rgb)
    );
    --ac-global-color-chartreuse-900-rgb: 138, 180, 3;
    --ac-global-color-chartreuse-900: rgb(
      var(--ac-global-color-chartreuse-900-rgb)
    );
    --ac-global-color-chartreuse-1000-rgb: 154, 198, 11;
    --ac-global-color-chartreuse-1000: rgb(
      var(--ac-global-color-chartreuse-1000-rgb)
    );
    --ac-global-color-chartreuse-1100-rgb: 170, 216, 22;
    --ac-global-color-chartreuse-1100: rgb(
      var(--ac-global-color-chartreuse-1100-rgb)
    );
    --ac-global-color-chartreuse-1200-rgb: 187, 232, 41;
    --ac-global-color-chartreuse-1200: rgb(
      var(--ac-global-color-chartreuse-1200-rgb)
    );
    --ac-global-color-chartreuse-1300-rgb: 205, 246, 72;
    --ac-global-color-chartreuse-1300: rgb(
      var(--ac-global-color-chartreuse-1300-rgb)
    );
    --ac-global-color-chartreuse-1400-rgb: 225, 253, 132;
    --ac-global-color-chartreuse-1400: rgb(
      var(--ac-global-color-chartreuse-1400-rgb)
    );
    --ac-global-color-celery-100-rgb: 0, 47, 7;
    --ac-global-color-celery-100: rgb(var(--ac-global-color-celery-100-rgb));
    --ac-global-color-celery-200-rgb: 0, 61, 9;
    --ac-global-color-celery-200: rgb(var(--ac-global-color-celery-200-rgb));
    --ac-global-color-celery-300-rgb: 0, 77, 12;
    --ac-global-color-celery-300: rgb(var(--ac-global-color-celery-300-rgb));
    --ac-global-color-celery-400-rgb: 0, 95, 15;
    --ac-global-color-celery-400: rgb(var(--ac-global-color-celery-400-rgb));
    --ac-global-color-celery-500-rgb: 0, 113, 15;
    --ac-global-color-celery-500: rgb(var(--ac-global-color-celery-500-rgb));
    --ac-global-color-celery-600-rgb: 0, 132, 15;
    --ac-global-color-celery-600: rgb(var(--ac-global-color-celery-600-rgb));
    --ac-global-color-celery-700-rgb: 0, 151, 20;
    --ac-global-color-celery-700: rgb(var(--ac-global-color-celery-700-rgb));
    --ac-global-color-celery-800-rgb: 13, 171, 37;
    --ac-global-color-celery-800: rgb(var(--ac-global-color-celery-800-rgb));
    --ac-global-color-celery-900-rgb: 45, 191, 58;
    --ac-global-color-celery-900: rgb(var(--ac-global-color-celery-900-rgb));
    --ac-global-color-celery-1000-rgb: 80, 208, 82;
    --ac-global-color-celery-1000: rgb(var(--ac-global-color-celery-1000-rgb));
    --ac-global-color-celery-1100-rgb: 115, 224, 107;
    --ac-global-color-celery-1100: rgb(var(--ac-global-color-celery-1100-rgb));
    --ac-global-color-celery-1200-rgb: 147, 237, 131;
    --ac-global-color-celery-1200: rgb(var(--ac-global-color-celery-1200-rgb));
    --ac-global-color-celery-1300-rgb: 180, 247, 165;
    --ac-global-color-celery-1300: rgb(var(--ac-global-color-celery-1300-rgb));
    --ac-global-color-celery-1400-rgb: 213, 252, 202;
    --ac-global-color-celery-1400: rgb(var(--ac-global-color-celery-1400-rgb));
    --ac-global-color-green-100-rgb: 10, 44, 28;
    --ac-global-color-green-100: rgb(var(--ac-global-color-green-100-rgb));
    --ac-global-color-green-200-rgb: 7, 59, 36;
    --ac-global-color-green-200: rgb(var(--ac-global-color-green-200-rgb));
    --ac-global-color-green-300-rgb: 0, 76, 46;
    --ac-global-color-green-300: rgb(var(--ac-global-color-green-300-rgb));
    --ac-global-color-green-400-rgb: 0, 93, 57;
    --ac-global-color-green-400: rgb(var(--ac-global-color-green-400-rgb));
    --ac-global-color-green-500-rgb: 0, 111, 69;
    --ac-global-color-green-500: rgb(var(--ac-global-color-green-500-rgb));
    --ac-global-color-green-600-rgb: 0, 130, 82;
    --ac-global-color-green-600: rgb(var(--ac-global-color-green-600-rgb));
    --ac-global-color-green-700-rgb: 0, 149, 98;
    --ac-global-color-green-700: rgb(var(--ac-global-color-green-700-rgb));
    --ac-global-color-green-800-rgb: 28, 168, 114;
    --ac-global-color-green-800: rgb(var(--ac-global-color-green-800-rgb));
    --ac-global-color-green-900-rgb: 52, 187, 132;
    --ac-global-color-green-900: rgb(var(--ac-global-color-green-900-rgb));
    --ac-global-color-green-1000-rgb: 75, 205, 149;
    --ac-global-color-green-1000: rgb(var(--ac-global-color-green-1000-rgb));
    --ac-global-color-green-1100-rgb: 103, 222, 168;
    --ac-global-color-green-1100: rgb(var(--ac-global-color-green-1100-rgb));
    --ac-global-color-green-1200-rgb: 137, 236, 188;
    --ac-global-color-green-1200: rgb(var(--ac-global-color-green-1200-rgb));
    --ac-global-color-green-1300-rgb: 177, 244, 209;
    --ac-global-color-green-1300: rgb(var(--ac-global-color-green-1300-rgb));
    --ac-global-color-green-1400-rgb: 214, 249, 228;
    --ac-global-color-green-1400: rgb(var(--ac-global-color-green-1400-rgb));
    --ac-global-color-seafoam-100-rgb: 18, 43, 42;
    --ac-global-color-seafoam-100: rgb(var(--ac-global-color-seafoam-100-rgb));
    --ac-global-color-seafoam-200-rgb: 19, 57, 55;
    --ac-global-color-seafoam-200: rgb(var(--ac-global-color-seafoam-200-rgb));
    --ac-global-color-seafoam-300-rgb: 16, 73, 70;
    --ac-global-color-seafoam-300: rgb(var(--ac-global-color-seafoam-300-rgb));
    --ac-global-color-seafoam-400-rgb: 3, 91, 88;
    --ac-global-color-seafoam-400: rgb(var(--ac-global-color-seafoam-400-rgb));
    --ac-global-color-seafoam-500-rgb: 0, 108, 104;
    --ac-global-color-seafoam-500: rgb(var(--ac-global-color-seafoam-500-rgb));
    --ac-global-color-seafoam-600-rgb: 0, 127, 121;
    --ac-global-color-seafoam-600: rgb(var(--ac-global-color-seafoam-600-rgb));
    --ac-global-color-seafoam-700-rgb: 0, 146, 140;
    --ac-global-color-seafoam-700: rgb(var(--ac-global-color-seafoam-700-rgb));
    --ac-global-color-seafoam-800-rgb: 0, 165, 159;
    --ac-global-color-seafoam-800: rgb(var(--ac-global-color-seafoam-800-rgb));
    --ac-global-color-seafoam-900-rgb: 26, 185, 178;
    --ac-global-color-seafoam-900: rgb(var(--ac-global-color-seafoam-900-rgb));
    --ac-global-color-seafoam-1000-rgb: 66, 202, 195;
    --ac-global-color-seafoam-1000: rgb(
      var(--ac-global-color-seafoam-1000-rgb)
    );
    --ac-global-color-seafoam-1100-rgb: 102, 218, 211;
    --ac-global-color-seafoam-1100: rgb(
      var(--ac-global-color-seafoam-1100-rgb)
    );
    --ac-global-color-seafoam-1200-rgb: 139, 232, 225;
    --ac-global-color-seafoam-1200: rgb(
      var(--ac-global-color-seafoam-1200-rgb)
    );
    --ac-global-color-seafoam-1300-rgb: 179, 242, 237;
    --ac-global-color-seafoam-1300: rgb(
      var(--ac-global-color-seafoam-1300-rgb)
    );
    --ac-global-color-seafoam-1400-rgb: 215, 248, 244;
    --ac-global-color-seafoam-1400: rgb(
      var(--ac-global-color-seafoam-1400-rgb)
    );
    --ac-global-color-cyan-100-rgb: 0, 41, 68;
    --ac-global-color-cyan-100: rgb(var(--ac-global-color-cyan-100-rgb));
    --ac-global-color-cyan-200-rgb: 0, 54, 88;
    --ac-global-color-cyan-200: rgb(var(--ac-global-color-cyan-200-rgb));
    --ac-global-color-cyan-300-rgb: 0, 69, 108;
    --ac-global-color-cyan-300: rgb(var(--ac-global-color-cyan-300-rgb));
    --ac-global-color-cyan-400-rgb: 0, 86, 128;
    --ac-global-color-cyan-400: rgb(var(--ac-global-color-cyan-400-rgb));
    --ac-global-color-cyan-500-rgb: 0, 103, 147;
    --ac-global-color-cyan-500: rgb(var(--ac-global-color-cyan-500-rgb));
    --ac-global-color-cyan-600-rgb: 0, 121, 167;
    --ac-global-color-cyan-600: rgb(var(--ac-global-color-cyan-600-rgb));
    --ac-global-color-cyan-700-rgb: 0, 140, 186;
    --ac-global-color-cyan-700: rgb(var(--ac-global-color-cyan-700-rgb));
    --ac-global-color-cyan-800-rgb: 4, 160, 205;
    --ac-global-color-cyan-800: rgb(var(--ac-global-color-cyan-800-rgb));
    --ac-global-color-cyan-900-rgb: 23, 180, 221;
    --ac-global-color-cyan-900: rgb(var(--ac-global-color-cyan-900-rgb));
    --ac-global-color-cyan-1000-rgb: 57, 199, 234;
    --ac-global-color-cyan-1000: rgb(var(--ac-global-color-cyan-1000-rgb));
    --ac-global-color-cyan-1100-rgb: 96, 216, 243;
    --ac-global-color-cyan-1100: rgb(var(--ac-global-color-cyan-1100-rgb));
    --ac-global-color-cyan-1200-rgb: 134, 230, 250;
    --ac-global-color-cyan-1200: rgb(var(--ac-global-color-cyan-1200-rgb));
    --ac-global-color-cyan-1300-rgb: 170, 242, 255;
    --ac-global-color-cyan-1300: rgb(var(--ac-global-color-cyan-1300-rgb));
    --ac-global-color-cyan-1400-rgb: 206, 249, 255;
    --ac-global-color-cyan-1400: rgb(var(--ac-global-color-cyan-1400-rgb));
    --ac-global-color-blue-100-rgb: 0, 38, 81;
    --ac-global-color-blue-100: rgb(var(--ac-global-color-blue-100-rgb));
    --ac-global-color-blue-200-rgb: 0, 50, 106;
    --ac-global-color-blue-200: rgb(var(--ac-global-color-blue-200-rgb));
    --ac-global-color-blue-300-rgb: 0, 64, 135;
    --ac-global-color-blue-300: rgb(var(--ac-global-color-blue-300-rgb));
    --ac-global-color-blue-400-rgb: 0, 78, 166;
    --ac-global-color-blue-400: rgb(var(--ac-global-color-blue-400-rgb));
    --ac-global-color-blue-500-rgb: 0, 92, 200;
    --ac-global-color-blue-500: rgb(var(--ac-global-color-blue-500-rgb));
    --ac-global-color-blue-600-rgb: 6, 108, 231;
    --ac-global-color-blue-600: rgb(var(--ac-global-color-blue-600-rgb));
    --ac-global-color-blue-700-rgb: 29, 128, 245;
    --ac-global-color-blue-700: rgb(var(--ac-global-color-blue-700-rgb));
    --ac-global-color-blue-800-rgb: 64, 150, 243;
    --ac-global-color-blue-800: rgb(var(--ac-global-color-blue-800-rgb));
    --ac-global-color-blue-900-rgb: 94, 170, 247;
    --ac-global-color-blue-900: rgb(var(--ac-global-color-blue-900-rgb));
    --ac-global-color-blue-1000-rgb: 124, 189, 250;
    --ac-global-color-blue-1000: rgb(var(--ac-global-color-blue-1000-rgb));
    --ac-global-color-blue-1100-rgb: 152, 206, 253;
    --ac-global-color-blue-1100: rgb(var(--ac-global-color-blue-1100-rgb));
    --ac-global-color-blue-1200-rgb: 179, 222, 254;
    --ac-global-color-blue-1200: rgb(var(--ac-global-color-blue-1200-rgb));
    --ac-global-color-blue-1300-rgb: 227, 234, 255;
    --ac-global-color-blue-1300: rgb(var(--ac-global-color-blue-1300-rgb));
    --ac-global-color-blue-1400-rgb: 243, 243, 255;
    --ac-global-color-blue-1400: rgb(var(--ac-global-color-blue-1400-rgb));
    --ac-global-color-indigo-100-rgb: 26, 29, 97;
    --ac-global-color-indigo-100: rgb(var(--ac-global-color-indigo-100-rgb));
    --ac-global-color-indigo-200-rgb: 35, 39, 125;
    --ac-global-color-indigo-200: rgb(var(--ac-global-color-indigo-200-rgb));
    --ac-global-color-indigo-300-rgb: 46, 50, 157;
    --ac-global-color-indigo-300: rgb(var(--ac-global-color-indigo-300-rgb));
    --ac-global-color-indigo-400-rgb: 58, 63, 189;
    --ac-global-color-indigo-400: rgb(var(--ac-global-color-indigo-400-rgb));
    --ac-global-color-indigo-500-rgb: 73, 78, 216;
    --ac-global-color-indigo-500: rgb(var(--ac-global-color-indigo-500-rgb));
    --ac-global-color-indigo-600-rgb: 90, 96, 235;
    --ac-global-color-indigo-600: rgb(var(--ac-global-color-indigo-600-rgb));
    --ac-global-color-indigo-700-rgb: 110, 115, 246;
    --ac-global-color-indigo-700: rgb(var(--ac-global-color-indigo-700-rgb));
    --ac-global-color-indigo-800-rgb: 132, 136, 253;
    --ac-global-color-indigo-800: rgb(var(--ac-global-color-indigo-800-rgb));
    --ac-global-color-indigo-900-rgb: 153, 159, 255;
    --ac-global-color-indigo-900: rgb(var(--ac-global-color-indigo-900-rgb));
    --ac-global-color-indigo-1000-rgb: 174, 177, 255;
    --ac-global-color-indigo-1000: rgb(var(--ac-global-color-indigo-1000-rgb));
    --ac-global-color-indigo-1100-rgb: 194, 196, 255;
    --ac-global-color-indigo-1100: rgb(var(--ac-global-color-indigo-1100-rgb));
    --ac-global-color-indigo-1200-rgb: 212, 213, 255;
    --ac-global-color-indigo-1200: rgb(var(--ac-global-color-indigo-1200-rgb));
    --ac-global-color-indigo-1300-rgb: 227, 228, 255;
    --ac-global-color-indigo-1300: rgb(var(--ac-global-color-indigo-1300-rgb));
    --ac-global-color-indigo-1400-rgb: 240, 240, 255;
    --ac-global-color-indigo-1400: rgb(var(--ac-global-color-indigo-1400-rgb));
    --ac-global-color-purple-100-rgb: 50, 16, 104;
    --ac-global-color-purple-100: rgb(var(--ac-global-color-purple-100-rgb));
    --ac-global-color-purple-200-rgb: 67, 13, 140;
    --ac-global-color-purple-200: rgb(var(--ac-global-color-purple-200-rgb));
    --ac-global-color-purple-300-rgb: 86, 16, 173;
    --ac-global-color-purple-300: rgb(var(--ac-global-color-purple-300-rgb));
    --ac-global-color-purple-400-rgb: 106, 29, 200;
    --ac-global-color-purple-400: rgb(var(--ac-global-color-purple-400-rgb));
    --ac-global-color-purple-500-rgb: 126, 49, 222;
    --ac-global-color-purple-500: rgb(var(--ac-global-color-purple-500-rgb));
    --ac-global-color-purple-600-rgb: 145, 70, 236;
    --ac-global-color-purple-600: rgb(var(--ac-global-color-purple-600-rgb));
    --ac-global-color-purple-700-rgb: 162, 94, 246;
    --ac-global-color-purple-700: rgb(var(--ac-global-color-purple-700-rgb));
    --ac-global-color-purple-800-rgb: 178, 119, 250;
    --ac-global-color-purple-800: rgb(var(--ac-global-color-purple-800-rgb));
    --ac-global-color-purple-900-rgb: 192, 143, 252;
    --ac-global-color-purple-900: rgb(var(--ac-global-color-purple-900-rgb));
    --ac-global-color-purple-1000-rgb: 206, 166, 253;
    --ac-global-color-purple-1000: rgb(var(--ac-global-color-purple-1000-rgb));
    --ac-global-color-purple-1100-rgb: 219, 188, 254;
    --ac-global-color-purple-1100: rgb(var(--ac-global-color-purple-1100-rgb));
    --ac-global-color-purple-1200-rgb: 230, 207, 254;
    --ac-global-color-purple-1200: rgb(var(--ac-global-color-purple-1200-rgb));
    --ac-global-color-purple-1300-rgb: 240, 224, 255;
    --ac-global-color-purple-1300: rgb(var(--ac-global-color-purple-1300-rgb));
    --ac-global-color-purple-1400-rgb: 248, 237, 255;
    --ac-global-color-purple-1400: rgb(var(--ac-global-color-purple-1400-rgb));
    --ac-global-color-fuchsia-100-rgb: 70, 14, 68;
    --ac-global-color-fuchsia-100: rgb(var(--ac-global-color-fuchsia-100-rgb));
    --ac-global-color-fuchsia-200-rgb: 93, 9, 92;
    --ac-global-color-fuchsia-200: rgb(var(--ac-global-color-fuchsia-200-rgb));
    --ac-global-color-fuchsia-300-rgb: 120, 0, 120;
    --ac-global-color-fuchsia-300: rgb(var(--ac-global-color-fuchsia-300-rgb));
    --ac-global-color-fuchsia-400-rgb: 145, 0, 78;
    --ac-global-color-fuchsia-400: rgb(var(--ac-global-color-fuchsia-400-rgb));
    --ac-global-color-fuchsia-500-rgb: 169, 19, 170;
    --ac-global-color-fuchsia-500: rgb(var(--ac-global-color-fuchsia-500-rgb));
    --ac-global-color-fuchsia-600-rgb: 209, 43, 114;
    --ac-global-color-fuchsia-600: rgb(var(--ac-global-color-fuchsia-600-rgb));
    --ac-global-color-fuchsia-700-rgb: 227, 69, 137;
    --ac-global-color-fuchsia-700: rgb(var(--ac-global-color-fuchsia-700-rgb));
    --ac-global-color-fuchsia-800-rgb: 241, 97, 156;
    --ac-global-color-fuchsia-800: rgb(var(--ac-global-color-fuchsia-800-rgb));
    --ac-global-color-fuchsia-900-rgb: 252, 124, 173;
    --ac-global-color-fuchsia-900: rgb(var(--ac-global-color-fuchsia-900-rgb));
    --ac-global-color-fuchsia-1000-rgb: 255, 152, 191;
    --ac-global-color-fuchsia-1000: rgb(
      var(--ac-global-color-fuchsia-1000-rgb)
    );
    --ac-global-color-fuchsia-1100-rgb: 255, 179, 207;
    --ac-global-color-fuchsia-1100: rgb(
      var(--ac-global-color-fuchsia-1100-rgb)
    );
    --ac-global-color-fuchsia-1200-rgb: 254, 202, 221;
    --ac-global-color-fuchsia-1200: rgb(
      var(--ac-global-color-fuchsia-1200-rgb)
    );
    --ac-global-color-fuchsia-1300-rgb: 255, 221, 233;
    --ac-global-color-fuchsia-1300: rgb(
      var(--ac-global-color-fuchsia-1300-rgb)
    );
    --ac-global-color-fuchsia-1400-rgb: 255, 236, 243;
    --ac-global-color-fuchsia-1400: rgb(
      var(--ac-global-color-fuchsia-1400-rgb)
    );
    --ac-global-color-magenta-100-rgb: 83, 3, 41;
    --ac-global-color-magenta-100: rgb(var(--ac-global-color-magenta-100-rgb));
    --ac-global-color-magenta-200-rgb: 106, 0, 52;
    --ac-global-color-magenta-200: rgb(var(--ac-global-color-magenta-200-rgb));
    --ac-global-color-magenta-300-rgb: 133, 0, 65;
    --ac-global-color-magenta-300: rgb(var(--ac-global-color-magenta-300-rgb));
    --ac-global-color-magenta-400-rgb: 161, 0, 78;
    --ac-global-color-magenta-400: rgb(var(--ac-global-color-magenta-400-rgb));
    --ac-global-color-magenta-500-rgb: 186, 22, 93;
    --ac-global-color-magenta-500: rgb(var(--ac-global-color-magenta-500-rgb));
    --ac-global-color-magenta-600-rgb: 209, 43, 114;
    --ac-global-color-magenta-600: rgb(var(--ac-global-color-magenta-600-rgb));
    --ac-global-color-magenta-700-rgb: 227, 69, 137;
    --ac-global-color-magenta-700: rgb(var(--ac-global-color-magenta-700-rgb));
    --ac-global-color-magenta-800-rgb: 241, 97, 156;
    --ac-global-color-magenta-800: rgb(var(--ac-global-color-magenta-800-rgb));
    --ac-global-color-magenta-900-rgb: 252, 124, 173;
    --ac-global-color-magenta-900: rgb(var(--ac-global-color-magenta-900-rgb));
    --ac-global-color-magenta-1000-rgb: 255, 152, 191;
    --ac-global-color-magenta-1000: rgb(
      var(--ac-global-color-magenta-1000-rgb)
    );
    --ac-global-color-magenta-1100-rgb: 255, 179, 207;
    --ac-global-color-magenta-1100: rgb(
      var(--ac-global-color-magenta-1100-rgb)
    );
    --ac-global-color-magenta-1200-rgb: 254, 202, 221;
    --ac-global-color-magenta-1200: rgb(
      var(--ac-global-color-magenta-1200-rgb)
    );
    --ac-global-color-magenta-1300-rgb: 255, 221, 233;
    --ac-global-color-magenta-1300: rgb(
      var(--ac-global-color-magenta-1300-rgb)
    );
    --ac-global-color-magenta-1400-rgb: 255, 236, 243;
    --ac-global-color-magenta-1400: rgb(
      var(--ac-global-color-magenta-1400-rgb)
    );

    // Semantic colors
    --ac-global-color-info-rgb: 114, 217, 255;
    --ac-global-color-info: rgb(var(--ac-global-color-info-rgb));
    --ac-global-color-info-900: rgba(var(--ac-global-color-info-rgb), 0.9);
    --ac-global-color-info-700: rgba(var(--ac-global-color-info-rgb), 0.7);
    --ac-global-color-info-500: rgba(var(--ac-global-color-info-rgb), 0.5);
    --ac-global-color-danger-rgb: 248, 81, 73;
    --ac-global-color-danger: rgb(var(--ac-global-color-danger-rgb));
    --ac-global-color-danger-900: rgba(var(--ac-global-color-danger-rgb), 0.9);
    --ac-global-color-danger-700: rgba(var(--ac-global-color-danger-rgb), 0.7);
    --ac-global-color-danger-500: rgba(var(--ac-global-color-danger-rgb), 0.5);
    --ac-global-color-success-rgb: 126, 231, 135;
    --ac-global-color-success: rgb(var(--ac-global-color-success-rgb));
    --ac-global-color-success-900: rgba(
      var(--ac-global-color-success-rgb),
      0.9
    );
    --ac-global-color-success-700: rgba(
      var(--ac-global-color-success-rgb),
      0.7
    );
    --ac-global-color-success-500: rgba(
      var(--ac-global-color-success-rgb),
      0.5
    );
    --ac-global-color-warning-rgb: 230, 153, 88;
    --ac-global-color-warning: rgb(var(--ac-global-color-warning-rgb));
    --ac-global-color-warning-900: rgba(
      var(--ac-global-color-warning-rgb),
      0.9
    );
    --ac-global-color-warning-700: rgba(
      var(--ac-global-color-warning-rgb),
      0.7
    );
    --ac-global-color-warning-500: rgba(
      var(--ac-global-color-warning-rgb),
      0.5
    );

    // Designation colors
    --ac-global-color-designation-purple: #bb9ff9;
    --ac-global-color-designation-turquoise: #9efcfd;

    --ac-global-text-color-900: rgba(255, 255, 255, 0.9);
    --ac-global-text-color-700: rgba(255, 255, 255, 0.7);
    --ac-global-text-color-500: rgba(255, 255, 255, 0.5);
    --ac-global-text-color-300: rgba(255, 255, 255, 0.3);

    // Link colors
    --ac-global-link-color: rgb(114, 217, 255);
    --ac-global-link-color-visited: var(--ac-global-color-purple-900);
  }
`;

export const lightThemeCSS = css`
  :root,
  .ac-theme--light {
    /* Colors */

    // The newer grays (grey)
    --ac-global-color-grey-50-rgb: 255, 255, 255;
    --ac-global-color-grey-50: rgb(var(--ac-global-color-grey-50-rgb));
    --ac-global-color-grey-75-rgb: 253, 253, 253;
    --ac-global-color-grey-75: rgb(var(--ac-global-color-grey-75-rgb));
    --ac-global-color-grey-100-rgb: 248, 248, 248;
    --ac-global-color-grey-100: rgb(var(--ac-global-color-grey-100-rgb));
    --ac-global-color-grey-200-rgb: 230, 230, 230;
    --ac-global-color-grey-200: rgb(var(--ac-global-color-grey-200-rgb));
    --ac-global-color-grey-300-rgb: 213, 213, 213;
    --ac-global-color-grey-300: rgb(var(--ac-global-color-grey-300-rgb));
    --ac-global-color-grey-400-rgb: 177, 177, 177;
    --ac-global-color-grey-400: rgb(var(--ac-global-color-grey-400-rgb));
    --ac-global-color-grey-500-rgb: 144, 144, 144;
    --ac-global-color-grey-500: rgb(var(--ac-global-color-grey-500-rgb));
    --ac-global-color-grey-600-rgb: 104, 104, 104;
    --ac-global-color-grey-600: rgb(var(--ac-global-color-grey-600-rgb));
    --ac-global-color-grey-700-rgb: 70, 70, 70;
    --ac-global-color-grey-700: rgb(var(--ac-global-color-grey-700-rgb));
    --ac-global-color-grey-800-rgb: 34, 34, 34;
    --ac-global-color-grey-800: rgb(var(--ac-global-color-grey-800-rgb));
    --ac-global-color-grey-900-rgb: 0, 0, 0;
    --ac-global-color-grey-900: rgb(var(--ac-global-color-grey-900-rgb));

    --ac-global-color-red-100: #ffebe7;
    --ac-global-color-red-200: #ffddd6;
    --ac-global-color-red-300: #ffcdc3;
    --ac-global-color-red-400: #ffb7a9;
    --ac-global-color-red-500: #ff9b88;
    --ac-global-color-red-600: #ff7c65;
    --ac-global-color-red-700: #f75c46;
    --ac-global-color-red-800: #ea3829;
    --ac-global-color-red-900: #d31510;
    --ac-global-color-red-1000: #b40000;
    --ac-global-color-red-1100: #930000;
    --ac-global-color-red-1200: #740000;
    --ac-global-color-red-1300: #590000;
    --ac-global-color-red-1400: #430000;
    --ac-global-color-orange-100: #ffeccc;
    --ac-global-color-orange-200: #ffdfad;
    --ac-global-color-orange-300: #fdd291;
    --ac-global-color-orange-400: #ffbb63;
    --ac-global-color-orange-500: #ffa037;
    --ac-global-color-orange-600: #f68511;
    --ac-global-color-orange-700: #e46f00;
    --ac-global-color-orange-800: #cb5d00;
    --ac-global-color-orange-900: #b14c00;
    --ac-global-color-orange-1000: #953d00;
    --ac-global-color-orange-1100: #7a2f00;
    --ac-global-color-orange-1200: #612300;
    --ac-global-color-orange-1300: #491901;
    --ac-global-color-orange-1400: #351201;
    --ac-global-color-yellow-100: #fbf198;
    --ac-global-color-yellow-200: #f8e750;
    --ac-global-color-yellow-300: #f8d904;
    --ac-global-color-yellow-400: #e8c600;
    --ac-global-color-yellow-500: #d7b300;
    --ac-global-color-yellow-600: #c49f00;
    --ac-global-color-yellow-700: #b08c00;
    --ac-global-color-yellow-800: #9b7800;
    --ac-global-color-yellow-900: #856600;
    --ac-global-color-yellow-1000: #705300;
    --ac-global-color-yellow-1100: #5b4300;
    --ac-global-color-yellow-1200: #483300;
    --ac-global-color-yellow-1300: #362500;
    --ac-global-color-yellow-1400: #281a00;
    --ac-global-color-chartreuse-100: #dbfc6e;
    --ac-global-color-chartreuse-200: #cbf443;
    --ac-global-color-chartreuse-300: #bce92a;
    --ac-global-color-chartreuse-400: #aad816;
    --ac-global-color-chartreuse-500: #98c50a;
    --ac-global-color-chartreuse-600: #87b103;
    --ac-global-color-chartreuse-700: #769c00;
    --ac-global-color-chartreuse-800: #678800;
    --ac-global-color-chartreuse-900: #577400;
    --ac-global-color-chartreuse-1000: #486000;
    --ac-global-color-chartreuse-1100: #3a4d00;
    --ac-global-color-chartreuse-1200: #2c3b00;
    --ac-global-color-chartreuse-1300: #212c00;
    --ac-global-color-chartreuse-1400: #181f00;
    --ac-global-color-celery-100: #cdfcbf;
    --ac-global-color-celery-200: #aef69d;
    --ac-global-color-celery-300: #96ee85;
    --ac-global-color-celery-400: #72e06a;
    --ac-global-color-celery-500: #4ecf50;
    --ac-global-color-celery-600: #27bb36;
    --ac-global-color-celery-700: #07a721;
    --ac-global-color-celery-800: #009112;
    --ac-global-color-celery-900: #007c0f;
    --ac-global-color-celery-1000: #00670f;
    --ac-global-color-celery-1100: #00530d;
    --ac-global-color-celery-1200: #00400a;
    --ac-global-color-celery-1300: #003007;
    --ac-global-color-celery-1400: #002205;
    --ac-global-color-green-100: #cef8e0;
    --ac-global-color-green-200: #adf4ce;
    --ac-global-color-green-300: #89ecbc;
    --ac-global-color-green-400: #67dea8;
    --ac-global-color-green-500: #49cc93;
    --ac-global-color-green-600: #2fb880;
    --ac-global-color-green-700: #15a46e;
    --ac-global-color-green-800: #008f5d;
    --ac-global-color-green-900: #007a4d;
    --ac-global-color-green-1000: #00653e;
    --ac-global-color-green-1100: #005132;
    --ac-global-color-green-1200: #053f27;
    --ac-global-color-green-1300: #0a2e1d;
    --ac-global-color-green-1400: #0a2015;
    --ac-global-color-seafoam-100: #cef7f3;
    --ac-global-color-seafoam-200: #aaf1ea;
    --ac-global-color-seafoam-300: #8ce9e2;
    --ac-global-color-seafoam-400: #65dad2;
    --ac-global-color-seafoam-500: #3fc9c1;
    --ac-global-color-seafoam-600: #0fb5ae;
    --ac-global-color-seafoam-700: #00a19a;
    --ac-global-color-seafoam-800: #008c87;
    --ac-global-color-seafoam-900: #007772;
    --ac-global-color-seafoam-1000: #00635f;
    --ac-global-color-seafoam-1100: #0c4f4c;
    --ac-global-color-seafoam-1200: #123c3a;
    --ac-global-color-seafoam-1300: #122c2b;
    --ac-global-color-seafoam-1400: #0f1f1e;
    --ac-global-color-cyan-100: #c5f8ff;
    --ac-global-color-cyan-200: #a4f0ff;
    --ac-global-color-cyan-300: #88e7fa;
    --ac-global-color-cyan-400: #60d8f3;
    --ac-global-color-cyan-500: #33c5e8;
    --ac-global-color-cyan-600: #12b0da;
    --ac-global-color-cyan-700: #019cc8;
    --ac-global-color-cyan-800: #0086b4;
    --ac-global-color-cyan-900: #00719f;
    --ac-global-color-cyan-1000: #005d89;
    --ac-global-color-cyan-1100: #004a73;
    --ac-global-color-cyan-1200: #00395d;
    --ac-global-color-cyan-1300: #002a46;
    --ac-global-color-cyan-1400: #001e33;
    --ac-global-color-blue-100: #e0f2ff;
    --ac-global-color-blue-200: #cae8ff;
    --ac-global-color-blue-300: #b5deff;
    --ac-global-color-blue-400: #96cefd;
    --ac-global-color-blue-500: #78bbfa;
    --ac-global-color-blue-600: #59a7f6;
    --ac-global-color-blue-700: #3892f3;
    --ac-global-color-blue-800: #147af3;
    --ac-global-color-blue-900: #0265dc;
    --ac-global-color-blue-1000: #0054b6;
    --ac-global-color-blue-1100: #004491;
    --ac-global-color-blue-1200: #003571;
    --ac-global-color-blue-1300: #002754;
    --ac-global-color-blue-1400: #001c3c;
    --ac-global-color-indigo-100: #edeeff;
    --ac-global-color-indigo-200: #e0e2ff;
    --ac-global-color-indigo-300: #d3d5ff;
    --ac-global-color-indigo-400: #c1c4ff;
    --ac-global-color-indigo-500: #acafff;
    --ac-global-color-indigo-600: #9599ff;
    --ac-global-color-indigo-700: #7e84fc;
    --ac-global-color-indigo-800: #686df4;
    --ac-global-color-indigo-900: #5258e4;
    --ac-global-color-indigo-1000: #4046ca;
    --ac-global-color-indigo-1100: #3236a8;
    --ac-global-color-indigo-1200: #262986;
    --ac-global-color-indigo-1300: #1b1e64;
    --ac-global-color-indigo-1400: #141648;
    --ac-global-color-purple-100: #f6ebff;
    --ac-global-color-purple-200: #edf;
    --ac-global-color-purple-300: #e6d0ff;
    --ac-global-color-purple-400: #dbbbfe;
    --ac-global-color-purple-500: #cca4fd;
    --ac-global-color-purple-600: #bd8bfc;
    --ac-global-color-purple-700: #ae72f9;
    --ac-global-color-purple-800: #9d57f4;
    --ac-global-color-purple-900: #893de7;
    --ac-global-color-purple-1000: #7326d3;
    --ac-global-color-purple-1100: #5d13b7;
    --ac-global-color-purple-1200: #470c94;
    --ac-global-color-purple-1300: #33106a;
    --ac-global-color-purple-1400: #230f49;
    --ac-global-color-fuchsia-100: #ffe9fc;
    --ac-global-color-fuchsia-200: #ffdafa;
    --ac-global-color-fuchsia-300: #fec7f8;
    --ac-global-color-fuchsia-400: #fbaef6;
    --ac-global-color-fuchsia-500: #f592f3;
    --ac-global-color-fuchsia-600: #ed74ed;
    --ac-global-color-fuchsia-700: #e055e2;
    --ac-global-color-fuchsia-800: #cd3ace;
    --ac-global-color-fuchsia-900: #b622b7;
    --ac-global-color-fuchsia-1000: #9d039e;
    --ac-global-color-fuchsia-1100: #800081;
    --ac-global-color-fuchsia-1200: #640664;
    --ac-global-color-fuchsia-1300: #470e46;
    --ac-global-color-fuchsia-1400: #320d31;
    --ac-global-color-magenta-100: #ffeaf1;
    --ac-global-color-magenta-200: #ffdce8;
    --ac-global-color-magenta-300: #ffcadd;
    --ac-global-color-magenta-400: #ffb2ce;
    --ac-global-color-magenta-500: #ff95bd;
    --ac-global-color-magenta-600: #fa77aa;
    --ac-global-color-magenta-700: #ef5a98;
    --ac-global-color-magenta-800: #de3d82;
    --ac-global-color-magenta-900: #c82269;
    --ac-global-color-magenta-1000: #ad0955;
    --ac-global-color-magenta-1100: #8e0045;
    --ac-global-color-magenta-1200: #700037;
    --ac-global-color-magenta-1300: #54032a;
    --ac-global-color-magenta-1400: #3c061d;

    // Semantic colors
    --ac-global-color-info: rgb(2, 173, 221);
    --ac-global-color-info-900: rgba(2, 173, 221, 0.9);
    --ac-global-color-info-700: rgba(2, 173, 221, 0.7);
    --ac-global-color-info-500: rgba(2, 173, 221, 0.5);
    --ac-global-color-danger: rgb(218, 11, 0);
    --ac-global-color-danger-900: rgba(218, 11, 0, 0.9);
    --ac-global-color-danger-700: rgba(218, 11, 0, 0.7);
    --ac-global-color-danger-500: rgba(218, 11, 0, 0.5);
    --ac-global-color-success: rgb(17, 191, 69);
    --ac-global-color-success-900: rgba(17, 191, 69, 0.9);
    --ac-global-color-success-700: rgba(17, 191, 69, 0.7);
    --ac-global-color-success-500: rgba(17, 191, 69, 0.5);
    --ac-global-color-warning: rgb(224, 102, 2);
    --ac-global-color-warning-900: rgba(224, 102, 2, 0.9);
    --ac-global-color-warning-700: rgba(224, 102, 2, 0.7);
    --ac-global-color-warning-500: rgba(224, 102, 2, 0.5);

    // Designation colors
    --ac-global-color-designation-purple: #4500d9;
    --ac-global-color-designation-turquoise: #00add0;

    --ac-global-text-color-900: rgba(0, 0, 0, 0.9);
    --ac-global-text-color-700: rgba(0, 0, 0, 0.7);
    --ac-global-text-color-500: rgba(0, 0, 0, 0.5);
    --ac-global-text-color-300: rgba(0, 0, 0, 0.3);

    --ac-global-link-color: rgb(9, 105, 218);
    --ac-global-link-color-visited: var(--ac-global-color-purple-900);
  }
`;

export const derivedCSS = (theme: ThemeContextType["theme"]) => css`
  :root,
  .ac-theme--${theme} {
    // The primary color tint for  the apps
    --ac-global-color-primary: var(--ac-global-color-grey-900);
    --ac-global-color-primary-900: rgba(
      var(--ac-global-color-grey-900-rgb),
      0.9
    );
    --ac-global-color-primary-800: rgba(
      var(--ac-global-color-grey-900-rgb),
      0.8
    );
    --ac-global-color-primary-700: rgba(
      var(--ac-global-color-grey-900-rgb),
      0.7
    );
    --ac-global-color-primary-600: rgba(
      var(--ac-global-color-grey-900-rgb),
      0.6
    );
    --ac-global-color-primary-500: rgba(
      var(--ac-global-color-grey-900-rgb),
      0.5
    );
    --ac-global-color-primary-400: rgba(
      var(--ac-global-color-grey-900-rgb),
      0.4
    );
    --ac-global-color-primary-300: rgba(
      var(--ac-global-color-grey-900-rgb),
      0.3
    );
    --ac-global-color-primary-200: rgba(
      var(--ac-global-color-grey-900-rgb),
      0.2
    );
    --ac-global-color-primary-100: rgba(
      var(--ac-global-color-grey-900-rgb),
      0.1
    );
    --ac-global-color-primary-50: rgba(
      var(--ac-global-color-grey-900-rgb),
      0.05
    );

    --ac-global-background-color-default: var(--ac-global-color-grey-100);
    --ac-global-background-color-light: var(--ac-global-color-grey-200);
    --ac-global-background-color-light-hover: var(--ac-global-color-grey-300);
    --ac-global-background-color-dark: var(--ac-global-color-grey-100);
    --ac-global-background-color-danger: var(--ac-global-color-danger);

    --ac-global-border-color-default: var(--ac-global-color-grey-300);
    --ac-global-border-color-light: var(--ac-global-color-grey-400);
    --ac-global-border-color-dark: var(--ac-global-color-grey-300);

    --ac-highlight-foreground: var(--ac-global-text-color-900);
    --ac-highlight-background: var(--ac-global-color-primary-100);
    --ac-hover-background: var(--ac-global-color-primary-50);
    --ac-focus-ring-color: var(--ac-global-color-primary-500);

    // Text
    --ac-text-color-placeholder: var(--ac-global-color-grey-400);

    // Styles for text fields etc
    --ac-global-input-field-border-color: var(--ac-global-color-grey-400);
    --ac-global-input-field-border-color-hover: var(--ac-global-color-grey-300);
    --ac-global-input-field-border-color-active: var(--ac-global-color-primary);
    --ac-global-input-field-background-color: var(--ac-global-color-grey-200);
    --ac-global-input-field-background-color-active: var(
      --ac-global-color-grey-300
    );

    // Styles for menus
    --ac-global-menu-border-color: var(--ac-global-color-grey-400);
    --ac-global-menu-background-color: var(--ac-global-color-grey-200);
    --ac-global-menu-item-background-color-hover: var(
      --ac-global-color-grey-300
    );

    // Styles for buttons
    --ac-global-button-primary-background-color: var(
      --ac-global-color-grey-900
    );
    --ac-global-button-primary-foreground-color: var(
      --ac-global-color-grey-100
    );
    --ac-global-button-primary-background-color-hover: var(
      --ac-global-color-grey-800
    );
    --ac-global-button-primary-border-color: var(--ac-global-color-grey-900);
    --ac-global-button-danger-background-color: var(
      --ac-global-color-danger-700
    );
    --ac-global-button-danger-background-color-hover: var(
      --ac-global-color-danger-900
    );
    --ac-global-button-danger-border-color: var(--ac-global-color-danger);
    --ac-global-button-success-background-color: var(
      --ac-global-color-success-700
    );
    --ac-global-button-success-background-color-hover: var(
      --ac-global-color-success-900
    );
    --ac-global-button-success-border-color: var(--ac-global-color-success);

    // Style for tooltips
    --ac-global-tooltip-background-color: var(--ac-global-color-grey-100);
    --ac-global-tooltip-border-color: var(--ac-global-color-grey-300);

    --ac-global-rounding-xsmall: var(--ac-global-dimension-static-size-25);
    --ac-global-rounding-small: var(--ac-global-dimension-static-size-50);
    --ac-global-rounding-medium: var(--ac-global-dimension-static-size-100);
    --ac-global-rounding-large: var(--ac-global-dimension-static-size-200);

    --ac-global-border-size-thin: var(--ac-global-dimension-static-size-10);
    --ac-global-border-size-thick: var(--ac-global-dimension-static-size-25);
    --ac-global-border-size-thicker: var(--ac-global-dimension-static-size-50);
    --ac-global-border-size-thickest: var(
      --ac-global-dimension-static-size-100
    );
    --ac-global-border-offset-thin: var(--ac-global-dimension-static-size-25);
    --ac-global-border-offset-thick: var(--ac-global-dimension-static-size-50);
    --ac-global-border-offset-thicker: var(
      --ac-global-dimension-static-size-100
    );
    --ac-global-border-offset-thickest: var(
      --ac-global-dimension-static-size-200
    );
    --ac-global-grid-baseline: var(--ac-global-dimension-static-size-100);
    --ac-global-grid-gutter-xsmall: var(--ac-global-dimension-static-size-200);
    --ac-global-grid-gutter-small: var(--ac-global-dimension-static-size-300);
    --ac-global-grid-gutter-medium: var(--ac-global-dimension-static-size-400);
    --ac-global-grid-gutter-large: var(--ac-global-dimension-static-size-500);
    --ac-global-grid-gutter-xlarge: var(--ac-global-dimension-static-size-600);
    --ac-global-grid-margin-xsmall: var(--ac-global-dimension-static-size-200);
    --ac-global-grid-margin-small: var(--ac-global-dimension-static-size-300);
    --ac-global-grid-margin-medium: var(--ac-global-dimension-static-size-400);
    --ac-global-grid-margin-large: var(--ac-global-dimension-static-size-500);
    --ac-global-grid-margin-xlarge: var(--ac-global-dimension-static-size-600);

    /* Aliases */
    --ac-alias-single-line-height: var(--ac-global-dimension-size-400);
    --ac-alias-single-line-width: var(--ac-global-dimension-size-2400);
  }
`;

const opacitiesCSS = css`
  :root {
    --ac-opacity-disabled: 0.6;
  }
`;

const appGlobalStylesCSS = css`
  body {
    background-color: var(--ac-global-color-grey-75);
    color: var(--ac-global-text-color-900);
    font-family: "Roboto";
    font-size: var(--ac-global-font-size-s);
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
      scrollbar-color: var(--ac-global-color-grey-300)
        var(--ac-global-color-grey-400);
    }

    /* Works on Chrome, Edge, and Safari */
    *::-webkit-scrollbar {
      width: 14px;
    }

    *::-webkit-scrollbar-track {
      background: var(--ac-global-color-grey-100);
    }

    *::-webkit-scrollbar-thumb {
      background-color: var(--ac-global-color-grey-75);
      border-radius: 8px;
      border: 1px solid var(--ac-global-color-grey-300);
    }
  }

  :root {
    --px-section-background-color: #2f353d;

    /** The color of shadows on menus etc. */
    --px-overlay-shadow-color: rgba(0, 0, 0, 0.4);

    /* An item is a typically something in a list */
    --px-item-background-color: #1d2126;
    --px-item-border-color: #282e35;

    --px-font-weight-heavy: 600;

    --px-gradient-bar-height: 8px;

    --px-nav-collapsed-width: 45px;
    --px-nav-expanded-width: 200px;

    --ac-global-opacity-disabled: 0.6;

    /* Text */
    --ac-global-font-size-xxs: 10px;
    --ac-global-font-size-xs: 12px;
    --ac-global-font-size-s: 14px;
    --ac-global-font-size-m: 16px;
    --ac-global-font-size-l: 18px;
    --ac-global-font-size-xl: 24px;
    --ac-global-font-size-xxl: 32px;

    --ac-global-line-height-xxs: 12px;
    --ac-global-line-height-xs: 16px;
    --ac-global-line-height-s: 20px;
    --ac-global-line-height-m: 24px;
    --ac-global-line-height-l: 28px;
    --ac-global-line-height-xl: 36px;
    --ac-global-line-height-xxl: 48px;

    /* Fields */
    --ac-global-input-field-min-width: 200px;

    /* Modal */
    --ac-global-modal-width-S: 500px;
    --ac-global-modal-width-M: 700px;
  }

  .ac-theme--dark {
    --px-primary-color: #9efcfd;
    --px-primary-color--transparent: rgb(158, 252, 253, 0.2);
    --px-reference-color: #baa1f9;
    --px-reference-color--transparent: #baa1f982;
    --px-corpus-color: #92969c;
    --px-corpus-color--transparent: #92969c63;
  }
  .ac-theme--light {
    --px-primary-color: #00add0;
    --px-primary-color--transparent: rgba(0, 173, 208, 0.2);
    --px-reference-color: #4500d9;
    --px-reference-color--transparent: rgba(69, 0, 217, 0.2);
    --px-corpus-color: #92969c;
    --px-corpus-color--transparent: #92969c63;
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

const ReactGridLayoutCSS = css`
  .react-grid-item.react-grid-placeholder {
    // the placeholder doesn't look good
    background: var(--ac-global-color-blue-500);
    opacity: 0.1;
  }
  .ac-theme--dark .react-resizable-handle {
    filter: invert(1);
  }
`;

export function GlobalStyles() {
  const { theme = "dark" } = useProvider();
  const themeCSS = theme === "dark" ? darkThemeCSS : lightThemeCSS;
  return (
    <Global
      styles={css(
        dimensionsCSS,
        staticCSS,
        themeCSS,
        derivedCSS(theme),
        mediumRootCSS,
        opacitiesCSS,
        appGlobalStylesCSS,
        codeMirrorOverridesCSS,
        ReactGridLayoutCSS
      )}
    />
  );
}
