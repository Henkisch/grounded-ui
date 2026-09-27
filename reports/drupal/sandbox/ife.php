<?php
use Drupal\Core\DrupalKernel;
use Symfony\Component\HttpFoundation\Request;
chdir(__DIR__);
$autoloader = require 'autoload.php';
$request = Request::create('/');
$kernel = DrupalKernel::createFromRequest($request, $autoloader, 'prod');
$kernel->boot();
$kernel->preHandle($request);
\Drupal::service('module_installer')->install(['inline_form_errors']);
if (($argv[1] ?? '') === 'olivero-admin') {
  \Drupal::configFactory()->getEditable('system.theme')->set('admin', 'olivero')->save();
}
drupal_flush_all_caches();
echo "ok\n";
