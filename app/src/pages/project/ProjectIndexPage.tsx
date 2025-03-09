import React from "react";
import { Navigate } from "react-router";

export const ProjectIndexPage = () => {
  // redirect to /traces
  return <Navigate to="traces" />;
};
