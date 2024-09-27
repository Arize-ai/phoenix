import React from "react";
import { useLoaderData } from "react-router";

import { Playground } from "./Playground";

export function SpanPlaygroundPage() {
  const data = useLoaderData();
  alert(JSON.stringify(data));
  return <Playground />;
}
