'use strict';

/**
 * Shared retry policy for ghost-engine Temporal workflows.
 * Referenced by: score-decay-workflow.js, sunday-evolution-workflow.js
 */
module.exports = {
  maximumAttempts: 5,
  initialInterval: '1s',
  backoffCoefficient: 2,
  maximumInterval: '1 minute',
};
