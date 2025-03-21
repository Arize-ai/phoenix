import React from "react";
import { Navigate } from "react-router";

export const ProjectIndexPage = () => {
  // redirect to /spans
  return <Navigate to="spans" replace />;
};
