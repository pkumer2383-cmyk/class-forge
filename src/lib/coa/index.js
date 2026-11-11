import { createCourtroomValidationService, runCourtroomValidation } from '../cvs/service.js';

export function createCentralOperatingAgent(options = {}) {
  const courtroomValidationSystem = createCourtroomValidationService(
    options.courtroomValidationSystem || options.cvs || {},
  );

  return {
    name: 'Central Operating Agent',
    divisions: {
      planning: { name: 'Planning Division', status: 'deferred' },
      knowledge: { name: 'Knowledge Division', status: 'deferred' },
      execution: { name: 'Execution Division', status: 'deferred' },
      monitoring: { name: 'Monitoring Division', status: 'deferred' },
      courtroomValidationSystem,
    },
    courtroomValidationSystem,
    validateIdea(input, validationOptions) {
      return courtroomValidationSystem.validateIdea(input, validationOptions);
    },
  };
}

export { runCourtroomValidation };
