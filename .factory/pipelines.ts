import { definePipelines } from '@theodo/bernard/config'

// The upstream skills are the project's to write: until it does, the feature starts from its plan.
export default definePipelines({
  pipelines: { default: { upstream: [{ id: 'migration-plan', mode: 'interactive', approver: 'dev' }] } },
})
