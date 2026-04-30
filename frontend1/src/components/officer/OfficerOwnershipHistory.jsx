import React from 'react';
import OfficerLayout from './OfficerLayout';
import OwnershipHistoryWorkspace from '../ownership/OwnershipHistoryWorkspace';

const OfficerOwnershipHistory = () => (
  <OfficerLayout title="Ownership History">
    <OwnershipHistoryWorkspace viewer="officer" />
  </OfficerLayout>
);

export default OfficerOwnershipHistory;
