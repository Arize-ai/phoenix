/*
 *                    Copyright 2023 Arize AI and contributors.
 *                     Licensed under the Elastic License 2.0;
 *   you may not use this file except in compliance with the Elastic License 2.0.
 */

import React from "react";
import { Global, css } from "@emotion/react";

export function GlobalStyles() {
  return (
    <Global
      styles={(theme) => css`
        body {
          background-color: ${theme.colors.gray800};
          color: ${theme.textColors.white90};
          font-family: "Roboto";
          margin: 0;
        }
      `}
    />
  );
}
