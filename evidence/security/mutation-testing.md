\# Pruebas de mutación (authz)



| # | Archivo | Mutación | Resultado |

|---|---|---|---|

| 1 | withAuthz.ts | Ruta no listada continúa en vez de 403 | Detectada (test fail-closed) |

| 2 | withAuthz.ts | Se desactiva la restricción de stage | Detectada (test de simulate fuera de academic) |

| 3 | withAuthz.ts | Opciones explícitas reemplazan la matriz | Detectada (test "no relajan la matriz") |

| 4 | rbac.ts | requireRole siempre pasa | Detectada (7 tests, incluidos T03 y T12) |

| 5 | ownership.ts | assertOwner no lanza ante otro sub | Detectada (T09, BOLA) |

| 6 | template.yaml | publish pasa de POST a PATCH | Detectada (contract.test.ts, entradas obsoletas) |



Las mutaciones 1 a 5 las aplicó el agente; la 6 se aplicó manualmente. Todas se revirtieron.

