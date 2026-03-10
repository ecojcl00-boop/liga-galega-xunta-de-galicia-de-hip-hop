import React, { createContext, useContext } from "react";

export const SimulacroContext = createContext({
  isSimulacro: false,
  activate: () => {},
  deactivate: () => {},
});

export function useSimulacro() {
  return useContext(SimulacroContext);
}