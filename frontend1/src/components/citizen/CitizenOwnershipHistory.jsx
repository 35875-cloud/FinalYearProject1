import React from 'react';
import CitizenLayout from './CitizenLayout';
import OwnershipHistoryWorkspace from '../ownership/OwnershipHistoryWorkspace';

const CitizenOwnershipHistory = () => (
  <CitizenLayout title="Ownership History">
    <OwnershipHistoryWorkspace viewer="citizen" />
  </CitizenLayout>
);

export default CitizenOwnershipHistory;
