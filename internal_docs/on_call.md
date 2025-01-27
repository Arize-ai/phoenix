# On-Call Guide

Being a maintainer of Phoenix and Openinference means you are responsible for the health of the project. This includes responding to issues, pull requests, and questions in a timely manner. Since this is a pretty big responsibility, we have a rotating on-call schedule to ensure that no one person is overwhelmed. The on-call schedule is maintained via PagerDuty, and you will receive notifications when you are on-call.

## Responsibilities

- Respond to queries as accurately as possible, preferably with a link to documentation, a work around, or a github issue
  - slack
    - \#phoenix-support
  - github
    - Phoenix
      - [Issues](https://github.com/Arize-ai/phoenix/issues)
      - [Discussions](https://github.com/Arize-ai/phoenix/discussions)
    - Openinference
      - [Issues](https://github.com/Arize-ai/openinference/issues)
- Replicate, Confirm, Triage bug reports across open source repositories
  - Phoenix
    - [New issues without comments](https://github.com/search?q=repo%3AArize-ai%2Fphoenix+-author%3Acephalization+-author%3Aaxiomofjoy+-author%3Arogerhyang+-author%3Amikeldking+-author%3Aanticorrelator+-author%3Ajgilhuly+state%3Aopen+comments%3A0&type=issues&ref=advsearch&s=created&o=desc)
  - Openinference
    - [New issues without comments](https://github.com/search?q=repo%3AArize-ai%2Fopeninference+-author%3Acephalization+-author%3Aaxiomofjoy+-author%3Arogerhyang+-author%3Amikeldking+-author%3Aanticorrelator+-author%3Ajgilhuly+state%3Aopen+comments%3A0&type=issues&ref=advsearch&s=created&o=desc)
- Accept or Reject Pull Requests, Review them if acceptable - [Phoenix](https://github.com/Arize-ai/phoenix/pulls) - [Openinference](https://github.com/Arize-ai/openinference/pulls)

### Priority Levels for Bug Fix

- P0: Should fix ASAP. Drop other tasks.
- P1: Should fix within one week.
- P2: Should fix within the next sprint. There's workaround but the bug is high visibility.
- P3: Backlog

## Tips

- "Watch" phoenix and openinference for all activity on github. You will get notifications for everything, including discussions.
- Try to respond quickly to questions and feedback, even if its just a thank you for reporting
- Practice scaffolding simple python and typescript scripts with openinference instrumentation setup
  - Make templates you can quickly copy and tweak for easier bug replication / confirmation
  - Try UV for easy python dependency management
