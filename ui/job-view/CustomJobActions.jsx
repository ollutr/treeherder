import React from 'react';
import PropTypes from 'prop-types';
import Ajv from 'ajv';
import jsonSchemaDefaults from 'json-schema-defaults';
import jsyaml from 'js-yaml';
import { slugid } from 'taskcluster-client-web';
import {
  Button, Modal, ModalHeader, ModalBody, ModalFooter,
} from 'reactstrap';

import { formatTaskclusterError } from '../helpers/errorMessage';

export default class CustomJobActions extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      ajv: new Ajv({ format: 'full', verbose: true, allErrors: true }),
      decisionTaskId: null,
      originalTaskId: null,
      originalTask: null,
      validate: null,
      actions: null,
      selectedAction: null,
      schema: null,
      payload: null,
    };
  }

  componentDidMount() {
    const { pushModel, pushId, tcactions, job } = this.props;

    pushModel.getGeckoDecisionTaskId(pushId).then((decisionTaskId) => {
      tcactions.load(decisionTaskId, job).then((results) => {
        const { originalTask, originalTaskId, staticActionVariables, actions } = results;

        this.setState({
          originalTask,
          originalTaskId,
          actions,
          staticActionVariables,
          selectedAction: actions[0],
        }, this.updateSelectedAction);
      });
      this.setState({ decisionTaskId });
    });
  }

  updateSelectedAction() {
    const { selectedAction, ajv } = this.state;

    if (selectedAction.schema) {
      this.setState({
        schema: jsyaml.safeDump(selectedAction.schema),
        payload: jsyaml.safeDump(jsonSchemaDefaults(selectedAction.schema)),
        validate: ajv.compile(selectedAction.schema),
      });
    } else {
      this.setState({ schema: null, payload: null, validate: null });
    }
  }

  triggerAction() {
    this.setState({ triggering: true });
    const {
      ajv, validate, payload, decisionTaskId, originalTaskId, originalTask,
      selectedAction, staticActionVariables,
    } = this.state;
    const { notify, tcactions } = this.props;

    let input = null;
    if (validate && payload) {
      try {
        input = jsyaml.safeLoad(payload);
      } catch (e) {
        this.setState({ triggering: false });
        notify.send(`YAML Error: ${e.message}`, 'danger');
        return;
      }
      const valid = validate(input);
      if (!valid) {
        this.setState({ triggering: false });
        notify.send(ajv.errorsText(validate.errors), 'danger');
        return;
      }
    }

    tcactions.submit({
       action: selectedAction,
       actionTaskId: slugid(),
       decisionTaskId,
       taskId: originalTaskId,
       task: originalTask,
       input,
       staticActionVariables,
     }).then((taskId) => {
      this.setState({ triggering: false });
      let message = 'Custom action request sent successfully:';
      let url = `https://tools.taskcluster.net/tasks/${taskId}`;

      // For the time being, we are redirecting specific actions to
      // specific urls that are different than usual. At this time, we are
      // only directing loaner tasks to the loaner UI in the tools site.
      // It is possible that we may make this a part of the spec later.
      const loaners = ['docker-worker-linux-loaner', 'generic-worker-windows-loaner'];
      if (loaners.indexOf(selectedAction.name) !== -1) {
        message = 'Visit Taskcluster Tools site to access loaner:';
        url = `${url}/connect`;
      }
      notify.send(message, 'success', { linkText: 'Open in Taskcluster', url });
      this.close('request sent');
    }, (e) => {
      notify.send(formatTaskclusterError(e), 'danger', { sticky: true });
      this.setState({ triggering: false });
      this.close('error');
    });
  }

  close() {
    // prevent closing of dialog while we're triggering
    const { triggering } = this.state;
    const { toggle } = this.props;

    if (!triggering) {
      toggle();
    }
  }

  render() {
    const { isLoggedIn, toggle } = this.props;
    const { triggering, selectedAction, schema, actions } = this.state;
    const isOpen = true;

    return (
      <Modal isOpen={isOpen} toggle={this.close} size="lg">
        <ModalHeader toggle={this.close}>Custom Taskcluster Job Actions</ModalHeader>
        <ModalBody>
          {!actions && <div className="modal-body">
            <p className="blink"> Getting available actions...</p>
          </div>}
          {!!actions && <div className="modal-body">
            <div className="form-group">
              <label>Action</label>
              <select
                aria-describedby="selectedActionHelp"
                className="form-control"
                ng-model="selectedAction"
                onChange={this.updateSelectedAction}
                ng-options="action.title for action in actions"
              />
              <p
                id="selectedActionHelp"
                className="help-block"
                marked="selectedAction.description"
              />
              {selectedAction.kind === 'hook' && <p>This action triggers hook
                <code>{selectedAction.hookGroupId}/{selectedAction.hookId}</code>
              </p>}
            </div>
            <div className="row">
              {!!selectedAction.schema && <React.Fragment>
                <div className="col-s-12 col-md-6 form-group">
                  <label>Payload</label>
                  <textarea
                    ng-model="input.payload"
                    className="form-control pre"
                    rows="10"
                    spellCheck="false"
                  />
                </div>
                <div className="col-s-12 col-md-6 form-group">
                  <label>Schema</label>
                  <textarea
                    className="form-control pre"
                    rows="10"
                    readOnly
                  >{schema}</textarea>
                </div>
              </React.Fragment>}
            </div>
          </div>}
        </ModalBody>
        <ModalFooter>
          {isLoggedIn ?
            <Button
              color="secondary"
              className={`btn btn-primary-soft ${triggering ? 'disabled' : ''}`}
              onClick={this.triggerAction()}
              title={isLoggedIn ? 'Trigger this action' : 'Not logged in'}
            >
              <span className="fa fa-check-square-o" aria-hidden="true" />
              <span>{triggering ? 'Triggering' : 'Trigger'}</span>
            </Button> :
            <p className="help-block" > Custom actions require login </p>
          }
          <Button color="secondary" onClick={toggle}>Cancel</Button>
        </ModalFooter>
      </Modal>
    );
  }
}

CustomJobActions.propTypes = {
  pushModel: PropTypes.object.isRequired,
  job: PropTypes.object.isRequired,
  pushId: PropTypes.number.isRequired,
  isLoggedIn: PropTypes.bool.isRequired,
  tcactions: PropTypes.object.isRequired,
  notify: PropTypes.object.isRequired,
  toggle: PropTypes.func.isRequired,
};
